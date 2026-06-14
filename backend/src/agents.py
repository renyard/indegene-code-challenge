"""
Recipe Companion Agent using pydantic-ai with AG-UI integration.

Uses pydantic-ai for both recipe parsing (structured output) and the main
chat agent (with tool calling via decorators and state management).
"""

from __future__ import annotations

import logging
import os
from textwrap import dedent

import httpx
from pydantic_ai import Agent, RunContext
from pydantic_ai.models import Model
from pydantic_ai.models.anthropic import AnthropicModel
from pydantic_ai.models.google import GoogleModel
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.ag_ui import StateDeps
from ag_ui.core import EventType, StateSnapshotEvent
from warp_cache import cache

from pydantic import BaseModel, Field

from .models import Recipe, RecipeContext, RecipeStep, SubstitutionResult

logger = logging.getLogger(__name__)

MODEL_NAME = os.getenv("LLM_MODEL", "gpt-4o").strip().strip('"').strip("'")
OPENAI_IMAGE_GENERATION_URL = "https://api.openai.com/v1/images/generations"


def build_model(name: str = MODEL_NAME) -> Model:
    if name.startswith(("gpt", "o1", "o3", "o4")):
        return OpenAIChatModel(name)
    if name.startswith("gemini"):
        return GoogleModel(name)
    if name.startswith("claude"):
        return AnthropicModel(name)
    raise ValueError(f"Unknown LLM_MODEL prefix: {name!r}")


class RecipeImageGenerationError(Exception):
    """Raised when the image provider cannot generate a recipe image."""

    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code


class RecipeImageResult(BaseModel):
    """Generated recipe image payload for the API layer."""

    data_url: str = Field(..., description="Browser-ready PNG data URL")
    mime_type: str = Field(default="image/png", description="Generated image MIME type")
    prompt: str = Field(..., description="Prompt sent to the image provider")


def build_recipe_image_prompt(recipe: Recipe) -> str:
    """Build a concise image prompt from structured recipe data."""
    ingredients = ", ".join(ing.name for ing in recipe.ingredients[:8])
    tags = ", ".join(recipe.dietary_tags[:4])
    cuisine = f"{recipe.cuisine} " if recipe.cuisine else ""
    description = f" {recipe.description}" if recipe.description else ""
    dietary = f" Dietary style: {tags}." if tags else ""

    return dedent(f"""
        Photorealistic food photography of the finished {cuisine}dish: {recipe.title}.
        {description}
        Key visible ingredients: {ingredients}.
        Present it as a fully cooked plated meal on a clean kitchen table, natural light,
        appetising texture, realistic colours, no text, no labels, no people.{dietary}
    """).strip()


async def generate_recipe_image(recipe: Recipe) -> RecipeImageResult:
    """
    Generate a finished-dish image for a recipe using OpenAI's Image API.

    This is intentionally independent from LLM_MODEL chat routing because image
    support differs by provider.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RecipeImageGenerationError(
            "OPENAI_API_KEY is required to generate recipe images.",
            status_code=503,
        )

    prompt = build_recipe_image_prompt(recipe)
    payload = {
        "model": "gpt-image-2",
        "prompt": prompt,
        "size": "1536x1024",
        "quality": "low",
        "n": 1,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                OPENAI_IMAGE_GENERATION_URL,
                headers=headers,
                json=payload,
            )
    except httpx.HTTPError as e:
        logger.warning("Recipe image generation request failed: %s", e)
        raise RecipeImageGenerationError(
            "Could not reach the image generation service.",
            status_code=503,
        ) from e

    if response.status_code >= 500 or response.status_code == 429:
        logger.warning(
            "Recipe image generation service unavailable: %s %s",
            response.status_code,
            response.text,
        )
        raise RecipeImageGenerationError(
            "Image generation is temporarily unavailable.",
            status_code=503,
        )
    if response.status_code >= 400:
        logger.warning(
            "Recipe image generation rejected request: %s %s",
            response.status_code,
            response.text,
        )
        raise RecipeImageGenerationError(
            "Image generation failed for this recipe.",
            status_code=502,
        )

    try:
        image_base64 = response.json()["data"][0]["b64_json"]
    except (KeyError, IndexError, TypeError, ValueError) as e:
        logger.warning("Recipe image generation returned no image data: %s", e)
        raise RecipeImageGenerationError(
            "Image generation returned no image data.",
            status_code=502,
        ) from e

    return RecipeImageResult(
        data_url=f"data:image/png;base64,{image_base64}",
        mime_type="image/png",
        prompt=prompt,
    )


# =============================================================================
# Recipe Parsing (separate agent for structured output)
# =============================================================================

PARSE_RECIPE_PROMPT = dedent("""
    You are a recipe parsing expert. Extract structured recipe data from the provided text.

    Guidelines:
    - Extract the recipe title, description, servings count, and timing information
    - Parse each ingredient with its quantity, unit, name, and preparation notes
    - Number and structure each cooking step starting from 1
    - Identify cuisine type and dietary tags if mentioned
    - Estimate difficulty based on technique complexity and time
    - If information is not explicitly stated, make reasonable inferences
    - For ambiguous quantities, use the most common interpretation

    Parse the following recipe text into a structured format.
""").strip()


@cache(max_size=1)
def get_recipe_parser() -> Agent[None, Recipe]:
    """Return the shared recipe parser agent, built on first call."""
    return Agent(
        model=build_model(),
        system_prompt=PARSE_RECIPE_PROMPT,
        output_type=Recipe,
    )


async def parse_recipe_from_text(document_text: str) -> Recipe | None:
    """
    Parse raw recipe text into a structured Recipe object using pydantic-ai.

    Args:
        document_text: Raw text extracted from uploaded document

    Returns:
        Parsed Recipe object, or None if parsing fails
    """
    try:
        parser = get_recipe_parser()
        result = await parser.run(document_text)
        return result.output
    except Exception as e:
        logger.warning(f"Recipe parsing failed: {e}")
        return None


# =============================================================================
# Ingredient Substitution (LLM-based matching)
# =============================================================================

SUBSTITUTION_PROMPT = dedent("""
    You are an expert chef helping with ingredient substitutions.

    Given a recipe's ingredient list and a substitution request, you must:
    1. Find the ingredient in the recipe that BEST MATCHES what the user wants to replace
       - Use fuzzy matching: "tomatoes" should match "Roma tomatoes" or "cherry tomatoes"
       - Consider partial matches: "garlic" matches "garlic cloves"
       - Be flexible with descriptors: "parmesan" matches "parmesan cheese"
    2. If a match is found, suggest appropriate quantity/unit adjustments if needed
    3. If NO match is found, set matched_ingredient to null and provide a helpful suggestion
       about what ingredients ARE in the recipe that might be relevant
    4. Provide a brief cooking tip about using the substitute if relevant

    IMPORTANT:
    - If the user's ingredient clearly refers to something in the recipe (even with different wording),
      find and return that match
    - Only set matched_ingredient to null if there's truly no relevant ingredient
    - The confidence score should reflect how well the match fits (1.0 = exact, 0.5+ = good partial match)
""").strip()


@cache(max_size=1)
def get_substitution_agent() -> Agent[None, SubstitutionResult]:
    """Return the shared substitution agent, built on first call."""
    return Agent(
        model=build_model(),
        system_prompt=SUBSTITUTION_PROMPT,
        output_type=SubstitutionResult,
    )


async def find_and_substitute(
    recipe: Recipe,
    original_ingredient: str,
    substitute_name: str,
) -> SubstitutionResult:
    """
    Use LLM to find the best matching ingredient and suggest substitution details.

    Args:
        recipe: The current recipe with ingredients
        original_ingredient: What the user wants to replace (may be fuzzy)
        substitute_name: What they want to use instead

    Returns:
        SubstitutionResult with matched ingredient and substitution details
    """
    # Format ingredients list for the prompt
    ingredients_text = "\n".join(
        f"- {ing.name}: {ing.quantity} {ing.unit or ''} {f'({ing.preparation})' if ing.preparation else ''}"
        for ing in recipe.ingredients
    )

    prompt = f"""
Recipe ingredients:
{ingredients_text}

User wants to replace: "{original_ingredient}"
With: "{substitute_name}"

Find the best matching ingredient and provide substitution details.
"""

    try:
        agent = get_substitution_agent()
        result = await agent.run(prompt)
        return result.output
    except Exception as e:
        logger.warning(f"LLM substitution matching failed: {e}")
        fallback_note = (
            "Note: the AI matcher was unavailable, so this fell back "
            "to an exact name match."
        )
        for ing in recipe.ingredients:
            if ing.name.lower() == original_ingredient.lower():
                return SubstitutionResult(
                    matched_ingredient=ing.name,
                    substitute_name=substitute_name,
                    substitute_quantity=ing.quantity,
                    substitute_unit=ing.unit,
                    confidence=0.5,
                    cooking_tip=fallback_note,
                )
        return SubstitutionResult(
            matched_ingredient=None,
            substitute_name=substitute_name,
            suggestion=(
                f"Could not find '{original_ingredient}' in the recipe. "
                "The AI matcher was also unavailable, so fuzzy matching was skipped."
            ),
        )


# =============================================================================
# Step Rewriting (rewrites cooking steps after a substitution)
# =============================================================================

REWRITE_STEPS_PROMPT = dedent("""
    Rewrite a recipe's cooking steps to reflect an ingredient substitution.

    Rules:
    - Replace references to the original ingredient with the substitute, including
      short forms (e.g. "oil" when the original is "olive oil", "cheese" for "parmesan cheese").
    - Preserve every other detail: quantities, timings, temperatures, techniques,
      order of instructions, punctuation style.
    - Return exactly the same number of steps, in the same order.
    - If a step does not reference the original ingredient, return it unchanged.
    - Use simple, direct language. Do not add advice or remove information.
""").strip()


class RewrittenSteps(BaseModel):
    steps: list[str] = Field(
        ...,
        description=(
            "Rewritten step instructions. Same length and order as the input."
        ),
    )


@cache(max_size=1)
def get_step_rewriter_agent() -> Agent[None, RewrittenSteps]:
    """Return the shared step-rewriter agent, built on first call."""
    return Agent(
        model=build_model(),
        system_prompt=REWRITE_STEPS_PROMPT,
        output_type=RewrittenSteps,
    )


async def rewrite_steps_for_substitution(
    steps: list[RecipeStep], original_name: str, substitute_name: str
) -> list[str] | None:
    """
    Ask the LLM to rewrite the given steps with one ingredient swapped in.

    Returns the new instruction strings (same length as input) or None if the
    rewriter fails or returns a mismatched length — callers should treat None
    as "keep the existing steps".
    """
    numbered = "\n".join(f"{i + 1}. {s.instruction}" for i, s in enumerate(steps))
    prompt = (
        f'Original ingredient: "{original_name}"\n'
        f'Substitute: "{substitute_name}"\n\n'
        f"Steps:\n{numbered}"
    )
    try:
        agent = get_step_rewriter_agent()
        result = await agent.run(prompt)
        rewritten = result.output.steps
    except Exception as e:
        logger.warning(f"Step rewriting failed: {e}")
        return None

    if len(rewritten) != len(steps):
        logger.warning(
            "Step rewriter returned %d steps for %d input — ignoring",
            len(rewritten),
            len(steps),
        )
        return None
    return rewritten


# =============================================================================
# Recipe Companion Agent (pydantic-ai with AG-UI)
# =============================================================================
recipe_agent = Agent(
    model=build_model(),
    deps_type=StateDeps[RecipeContext],
    name="recipe_agent",
)

CHAT_PROMPT = dedent("""
    You are a warm, practical cooking companion — like a patient friend
    in the kitchen. Keep replies short and friendly.

    HOW TO RESPOND

    - When the user asks to change the recipe, call a tool. Do not describe
      a change instead of making it.
    - Pick the tool by the verb in the request:
      * scale, double, halve, "for N people", "change servings"   → scale_recipe
      * substitute, replace, swap, "use X instead", "I don't have Y" → substitute_ingredient
      * "next step", "done", "finished", "start cooking"           → update_cooking_progress
    - If the request is genuinely ambiguous, ask one short question.
    - After a tool call, reply in one or two sentences: confirm the change
      and add a single practical tip if it helps.
    - If no tool fits, just answer the question.

    NEVER

    - Invent ingredients that are not in the current recipe.
    - Ask for information already in the recipe state (servings, current
      step, ingredient list) — read it.
    - Repeat a tool call you just made in the same turn.
    - Write long explanations, markdown headings or bullet lists in chat.
""").strip()


@recipe_agent.instructions
def recipe_instructions(ctx: RunContext[StateDeps[RecipeContext]]) -> str:
    """Dynamic system prompt with current recipe context."""
    base_prompt = CHAT_PROMPT
    state = ctx.deps.state

    if state.recipe:
        base_prompt += f"\n\nCURRENT RECIPE: {state.recipe.title}"
        base_prompt += f"\nServings: {state.recipe.servings}"
        if state.recipe.original_servings:
            base_prompt += f" (originally {state.recipe.original_servings})"
        if state.scaled_servings is not None:
            base_prompt += f"\nScaled to: {state.scaled_servings} servings"
        base_prompt += f"\nIngredients: {len(state.recipe.ingredients)}"
        base_prompt += f"\nSteps: {len(state.recipe.steps)}"
        base_prompt += f"\nCurrent step: {state.current_step}"
        base_prompt += f"\nCooking started: {'yes' if state.cooking_started else 'no'}"
        if state.checked_ingredients:
            base_prompt += (
                f"\nChecked ingredients: {', '.join(state.checked_ingredients)}"
            )

    return base_prompt


# =============================================================================
# Tools
# =============================================================================


@recipe_agent.tool
def scale_recipe(
    ctx: RunContext[StateDeps[RecipeContext]], target_servings: int
) -> StateSnapshotEvent | str:
    """
    Scale the recipe to a different number of servings.

    Use when user asks to scale, double, halve, or change servings.

    Args:
        target_servings: The target number of servings to scale to
    """
    state = ctx.deps.state
    if state.recipe is None:
        return "No recipe is currently loaded. Please upload a recipe first."
    if target_servings <= 0:
        return (
            f"Cannot scale to {target_servings} servings — "
            "target_servings must be a positive integer."
        )

    original_servings = state.recipe.servings
    state.recipe = state.recipe.scale(target_servings)
    state.scaled_servings = target_servings

    logger.info(f"Scaled recipe from {original_servings} to {target_servings} servings")

    return StateSnapshotEvent(type=EventType.STATE_SNAPSHOT, snapshot=state)


@recipe_agent.tool
async def substitute_ingredient(
    ctx: RunContext[StateDeps[RecipeContext]],
    original_ingredient: str,
    substitute_name: str,
) -> StateSnapshotEvent | str:
    """
    Replace an ingredient with a substitute using intelligent matching.

    Use when user doesn't have an ingredient or asks about alternatives.
    Uses LLM to find the best matching ingredient even with fuzzy names
    (e.g., "tomatoes" will match "Roma tomatoes").

    Args:
        original_ingredient: Name of the ingredient to replace (can be fuzzy)
        substitute_name: Name of the substitute ingredient
    """
    state = ctx.deps.state
    if state.recipe is None:
        return "No recipe is currently loaded. Please upload a recipe first."

    # Use LLM to find best match and get substitution details
    result = await find_and_substitute(
        state.recipe, original_ingredient, substitute_name
    )

    if result.matched_ingredient is None:
        # No match found - return helpful suggestion
        suggestion = (
            result.suggestion
            or f"Could not find '{original_ingredient}' in the recipe."
        )
        available = ", ".join(ing.name for ing in state.recipe.ingredients)
        return f"{suggestion} Available ingredients include: {available}"

    # Apply the substitution using the matched ingredient name. This handles
    # the ingredient list and any exact full-name references in the steps.
    state.recipe = state.recipe.substitute_ingredient(
        result.matched_ingredient,
        result.substitute_name,
        result.substitute_quantity,
        result.substitute_unit,
    )

    # Ask the LLM to rewrite the steps for short-form references (e.g. steps
    # that say "oil" when the ingredient is "olive oil"). If it fails, keep
    # the regex-only result.
    rewritten = await rewrite_steps_for_substitution(
        state.recipe.steps, result.matched_ingredient, result.substitute_name
    )
    if rewritten is not None:
        state.recipe = state.recipe.model_copy(
            update={
                "steps": [
                    step.model_copy(update={"instruction": instruction})
                    for step, instruction in zip(state.recipe.steps, rewritten)
                ]
            }
        )

    logger.info(
        f"Substituted '{result.matched_ingredient}' with '{result.substitute_name}' "
        f"(user requested: '{original_ingredient}', confidence: {result.confidence})"
    )

    return StateSnapshotEvent(type=EventType.STATE_SNAPSHOT, snapshot=state)


@recipe_agent.tool
def update_cooking_progress(
    ctx: RunContext[StateDeps[RecipeContext]],
    current_step: int | None = None,
    cooking_started: bool | None = None,
) -> StateSnapshotEvent | str:
    """
    Update the current cooking step or cooking status.

    Use when user says 'next step', 'done with step X', or wants to track progress.

    Args:
        current_step: Step number to set (0-indexed)
        cooking_started: Whether cooking has started
    """
    state = ctx.deps.state

    if current_step is not None:
        if state.recipe is None:
            return "No recipe is currently loaded. Please upload a recipe first."
        step_count = len(state.recipe.steps)
        if not 0 <= current_step < step_count:
            return (
                f"Step {current_step} is out of range — "
                f"this recipe has steps 0 to {step_count - 1}."
            )
        state.current_step = current_step
        logger.info(f"Updated current step to {current_step}")

    if cooking_started is not None:
        state.cooking_started = cooking_started
        logger.info(f"Updated cooking_started to {cooking_started}")

    return StateSnapshotEvent(type=EventType.STATE_SNAPSHOT, snapshot=state)
