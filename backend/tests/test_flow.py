"""Tests for the Recipe Companion backend.

Tests cover:
- Upload endpoint
- Recipe model methods (scale, substitute)
- CopilotKit endpoints
"""

from io import BytesIO
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient, Response

from src.models import (
    Ingredient,
    Recipe,
    RecipeContext,
    RecipeStep,
    SubstitutionResult,
)


class FakeImageClient:
    """Async context manager used to mock the outbound OpenAI image request."""

    def __init__(self, response: Response) -> None:
        self.response = response
        self.post_kwargs = {}

    async def __aenter__(self) -> "FakeImageClient":
        return self

    async def __aexit__(self, *args) -> None:
        return None

    async def post(self, *args, **kwargs) -> Response:
        self.post_kwargs = kwargs
        return self.response


class TestUploadEndpoint:
    """Tests for POST /upload endpoint."""

    async def test_upload_returns_parsed_recipe(
        self, client: AsyncClient, sample_recipe: Recipe
    ) -> None:
        """Verify upload returns parsed recipe when parsing succeeds."""
        content = b"Pasta al Pomodoro recipe text..."
        files = {"file": ("pasta.txt", BytesIO(content), "text/plain")}

        with patch(
            "src.main.parse_recipe_from_text", new_callable=AsyncMock
        ) as mock_parse:
            mock_parse.return_value = sample_recipe

            response = await client.post("/upload", files=files)

        assert response.status_code == 200
        data = response.json()
        assert data["state"]["recipe"] is not None
        assert "Pasta al Pomodoro" in data["state"]["document_text"]
        assert data["state"]["recipe"]["title"] == "Pasta al Pomodoro"
        assert data["state"]["recipe"]["servings"] == 4
        assert len(data["state"]["recipe"]["ingredients"]) == 6
        assert data["threadId"] is not None

    async def test_upload_response_has_stable_shape(
        self, client: AsyncClient, sample_recipe: Recipe
    ) -> None:
        """Response must expose the CopilotKit-shaped envelope keys."""
        files = {"file": ("pasta.txt", BytesIO(b"recipe"), "text/plain")}

        with patch(
            "src.main.parse_recipe_from_text", new_callable=AsyncMock
        ) as mock_parse:
            mock_parse.return_value = sample_recipe
            response = await client.post("/upload", files=files)

        data = response.json()
        assert set(data.keys()) == {
            "threadId",
            "runId",
            "state",
            "tools",
            "context",
            "forwardedProps",
            "messages",
        }
        assert isinstance(data["state"], dict)
        assert data["tools"] == []
        assert data["context"] == []
        assert data["forwardedProps"] == {}
        assert data["messages"] == []

    async def test_upload_response_excludes_source_text_from_recipe(
        self, client: AsyncClient, sample_recipe: Recipe
    ) -> None:
        """Recipe.source_text must not bloat the recipe payload."""
        files = {"file": ("pasta.txt", BytesIO(b"big recipe text"), "text/plain")}

        with patch(
            "src.main.parse_recipe_from_text", new_callable=AsyncMock
        ) as mock_parse:
            mock_parse.return_value = sample_recipe
            response = await client.post("/upload", files=files)

        data = response.json()
        assert "source_text" not in data["state"]["recipe"]


class TestRecipeImageEndpoint:
    """Tests for POST /recipe-image endpoint."""

    async def test_recipe_image_returns_data_url(
        self,
        client: AsyncClient,
        sample_recipe: Recipe,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """A successful provider response returns a browser-ready image payload."""
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
        fake_client = FakeImageClient(
            Response(
                200,
                json={"data": [{"b64_json": "abc123"}]},
            )
        )

        with patch("src.agents.httpx.AsyncClient", return_value=fake_client):
            response = await client.post(
                "/recipe-image",
                json={"recipe": sample_recipe.model_dump()},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["dataUrl"] == "data:image/png;base64,abc123"
        assert data["mimeType"] == "image/png"
        assert "Pasta al Pomodoro" in data["prompt"]

        request_kwargs = fake_client.post_kwargs
        assert request_kwargs["json"]["model"] == "gpt-image-2"
        assert request_kwargs["json"]["size"] == "1536x1024"
        assert request_kwargs["json"]["quality"] == "low"

    async def test_recipe_image_requires_openai_api_key(
        self,
        client: AsyncClient,
        sample_recipe: Recipe,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Missing OPENAI_API_KEY returns a service error, not a traceback."""
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)

        response = await client.post(
            "/recipe-image",
            json={"recipe": sample_recipe.model_dump()},
        )

        assert response.status_code == 503
        assert "OPENAI_API_KEY" in response.json()["detail"]

    async def test_recipe_image_maps_provider_error(
        self,
        client: AsyncClient,
        sample_recipe: Recipe,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Provider failures are translated to non-500 API errors."""
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
        fake_client = FakeImageClient(
            Response(
                401,
                json={"error": {"message": "bad key"}},
            )
        )

        with patch("src.agents.httpx.AsyncClient", return_value=fake_client):
            response = await client.post(
                "/recipe-image",
                json={"recipe": sample_recipe.model_dump()},
            )

        assert response.status_code == 502

    async def test_recipe_image_maps_empty_provider_response(
        self,
        client: AsyncClient,
        sample_recipe: Recipe,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """A provider response without image data returns a non-500 API error."""
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
        fake_client = FakeImageClient(Response(200, json={"data": []}))

        with patch("src.agents.httpx.AsyncClient", return_value=fake_client):
            response = await client.post(
                "/recipe-image",
                json={"recipe": sample_recipe.model_dump()},
            )

        assert response.status_code == 502

    async def test_recipe_image_rejects_malformed_recipe_payload(
        self,
        client: AsyncClient,
    ) -> None:
        """FastAPI validation rejects malformed recipe payloads."""
        response = await client.post("/recipe-image", json={"recipe": {"title": ""}})

        assert response.status_code == 422


class TestRecipeSerialisation:
    """Tests for Recipe model serialisation."""

    def test_recipe_dump_has_no_source_text_key(self, sample_recipe: Recipe) -> None:
        """source_text field is dropped so it doesn't ship in every SSE event."""
        assert "source_text" not in sample_recipe.model_dump()


class TestRecipeInstructions:
    """Tests for the dynamic recipe_instructions prompt."""

    def _ctx(self, state: RecipeContext) -> MagicMock:
        ctx = MagicMock()
        ctx.deps.state = state
        return ctx

    def test_instructions_include_checked_ingredients(
        self, sample_recipe: Recipe
    ) -> None:
        """Checked ingredients must be surfaced to the agent."""
        from src.agents import recipe_instructions

        state = RecipeContext(
            recipe=sample_recipe,
            checked_ingredients=["garlic", "olive oil"],
        )
        prompt = recipe_instructions(self._ctx(state))

        assert "garlic" in prompt
        assert "olive oil" in prompt

    def test_instructions_include_scaled_servings(self, sample_recipe: Recipe) -> None:
        """Scaled servings must appear so the agent doesn't re-suggest scaling."""
        from src.agents import recipe_instructions

        state = RecipeContext(recipe=sample_recipe, scaled_servings=8)
        prompt = recipe_instructions(self._ctx(state))

        assert "8" in prompt
        assert "scaled" in prompt.lower()

    def test_instructions_differ_when_cooking_started(
        self, sample_recipe: Recipe
    ) -> None:
        """The cooking_started flag must produce a visibly different prompt."""
        from src.agents import recipe_instructions

        started = recipe_instructions(
            self._ctx(RecipeContext(recipe=sample_recipe, cooking_started=True))
        )
        not_started = recipe_instructions(
            self._ctx(RecipeContext(recipe=sample_recipe, cooking_started=False))
        )

        assert started != not_started


class TestStepRewriting:
    """LLM-backed step rewriting after a substitution."""

    async def test_rewrite_steps_updates_instruction_and_timer_label(self) -> None:
        """The rewriter returns both rewritten instructions and rewritten timer labels."""
        from src.agents import RewrittenStep, rewrite_steps_for_substitution

        steps = [
            RecipeStep(
                step_number=1,
                instruction="Marinate the chicken for 10 minutes",
                timer_label="Marinate Chicken",
            ),
            RecipeStep(step_number=2, instruction="Stir fry"),
        ]

        fake_output = MagicMock()
        fake_output.steps = [
            RewrittenStep(
                instruction="Marinate the pork for 10 minutes",
                timer_label="Marinate pork",
            ),
            RewrittenStep(instruction="Stir fry", timer_label=None),
        ]

        with patch("src.agents.get_step_rewriter_agent") as mock_get_agent:
            mock_agent = AsyncMock()
            mock_agent.run.return_value = AsyncMock(output=fake_output)
            mock_get_agent.return_value = mock_agent

            result = await rewrite_steps_for_substitution(steps, "chicken", "pork")

        assert result is not None
        assert result[0].instruction == "Marinate the pork for 10 minutes"
        assert result[0].timer_label == "Marinate pork"
        assert result[1].instruction == "Stir fry"
        assert result[1].timer_label is None

    async def test_rewrite_steps_returns_none_on_length_mismatch(self) -> None:
        """If the LLM returns the wrong number of steps, the result is ignored."""
        from src.agents import RewrittenStep, rewrite_steps_for_substitution

        steps = [
            RecipeStep(step_number=1, instruction="Heat oil"),
            RecipeStep(step_number=2, instruction="Add garlic"),
        ]
        fake_output = MagicMock()
        fake_output.steps = [RewrittenStep(instruction="Heat butter")]  # one short

        with patch("src.agents.get_step_rewriter_agent") as mock_get_agent:
            mock_agent = AsyncMock()
            mock_agent.run.return_value = AsyncMock(output=fake_output)
            mock_get_agent.return_value = mock_agent

            result = await rewrite_steps_for_substitution(steps, "olive oil", "butter")

        assert result is None

    async def test_rewrite_steps_returns_none_on_llm_failure(self) -> None:
        """If the LLM raises, the rewriter returns None and does not propagate."""
        from src.agents import rewrite_steps_for_substitution

        steps = [RecipeStep(step_number=1, instruction="Heat oil")]

        with patch("src.agents.get_step_rewriter_agent") as mock_get_agent:
            mock_agent = AsyncMock()
            mock_agent.run.side_effect = Exception("LLM down")
            mock_get_agent.return_value = mock_agent

            result = await rewrite_steps_for_substitution(steps, "olive oil", "butter")

        assert result is None

    async def test_substitute_tool_applies_llm_rewritten_steps_and_labels(
        self, sample_recipe: Recipe
    ) -> None:
        """The tool applies the LLM's rewritten instruction AND timer_label per step."""
        from src.agents import RewrittenStep, substitute_ingredient

        state = RecipeContext(recipe=sample_recipe)
        ctx = MagicMock()
        ctx.deps.state = state

        with (
            patch("src.agents.find_and_substitute", new_callable=AsyncMock) as mock_fas,
            patch(
                "src.agents.rewrite_steps_for_substitution", new_callable=AsyncMock
            ) as mock_rewriter,
        ):
            mock_fas.return_value = SubstitutionResult(
                matched_ingredient="olive oil",
                substitute_name="butter",
                substitute_quantity=3.0,
                substitute_unit="tbsp",
                confidence=0.95,
            )
            mock_rewriter.return_value = [
                RewrittenStep(instruction="Boil water and cook pasta"),
                RewrittenStep(
                    instruction="Sauté garlic in butter", timer_label="Sauté butter"
                ),
                RewrittenStep(instruction="Add tomatoes and simmer"),
                RewrittenStep(
                    instruction="Combine pasta with sauce, add basil and parmesan"
                ),
            ]

            await substitute_ingredient(ctx, "olive oil", "butter")

        instructions = [s.instruction for s in state.recipe.steps]
        assert "Sauté garlic in butter" in instructions
        assert not any("olive oil" in i for i in instructions)
        assert state.recipe.steps[1].timer_label == "Sauté butter"

    async def test_substitute_tool_falls_back_to_regex_when_rewriter_fails(
        self, sample_recipe: Recipe
    ) -> None:
        """If the step rewriter fails, the tool keeps the regex-only step result."""
        from src.agents import substitute_ingredient

        state = RecipeContext(recipe=sample_recipe)
        ctx = MagicMock()
        ctx.deps.state = state

        with (
            patch("src.agents.find_and_substitute", new_callable=AsyncMock) as mock_fas,
            patch(
                "src.agents.rewrite_steps_for_substitution", new_callable=AsyncMock
            ) as mock_rewriter,
        ):
            mock_fas.return_value = SubstitutionResult(
                matched_ingredient="parmesan",
                substitute_name="pecorino",
                confidence=0.9,
            )
            mock_rewriter.return_value = None  # rewriter fails

            await substitute_ingredient(ctx, "parmesan", "pecorino")

        # The regex path still applied because the original step text contained
        # the full ingredient name "parmesan".
        final_step = state.recipe.steps[-1].instruction
        assert "pecorino" in final_step
        assert "parmesan" not in final_step.lower()


class TestSubstituteIngredientToolErrors:
    """Tests for substitute_ingredient tool error paths."""

    async def test_no_match_error_lists_all_ingredients(
        self, sample_recipe: Recipe
    ) -> None:
        """Error message must list every ingredient, not just the first five."""
        from src.agents import substitute_ingredient

        ctx = MagicMock()
        ctx.deps.state = RecipeContext(recipe=sample_recipe)

        with patch(
            "src.agents.find_and_substitute", new_callable=AsyncMock
        ) as mock_fas:
            mock_fas.return_value = SubstitutionResult(
                matched_ingredient=None,
                substitute_name="margarine",
                suggestion="No butter in this recipe.",
            )
            result = await substitute_ingredient(ctx, "butter", "margarine")

        assert isinstance(result, str)
        for ing in sample_recipe.ingredients:
            assert ing.name in result, f"missing {ing.name!r} from {result!r}"


class TestAgentFactories:
    """Singletons for the recipe parser / substitution agent must be
    cache-backed, not module-level mutable globals."""

    def test_no_module_level_recipe_parser_global(self) -> None:
        from src import agents

        assert not hasattr(agents, "_recipe_parser"), (
            "mutable module-level singleton should be replaced with a cache-backed factory"
        )

    def test_no_module_level_substitution_agent_global(self) -> None:
        from src import agents

        assert not hasattr(agents, "_substitution_agent"), (
            "mutable module-level singleton should be replaced with a cache-backed factory"
        )

    def test_get_recipe_parser_returns_same_instance(self) -> None:
        from src.agents import get_recipe_parser

        assert get_recipe_parser() is get_recipe_parser()

    def test_get_substitution_agent_returns_same_instance(self) -> None:
        from src.agents import get_substitution_agent

        assert get_substitution_agent() is get_substitution_agent()


class TestCopilotKitEndpoints:
    """Smoke tests for the CopilotKit AG-UI mount.

    These do not validate tool behaviour — integration tests do that. They
    only verify the endpoint accepts the CopilotKit payload shape and runs
    the agent end-to-end against an in-memory `TestModel` (no real LLM).
    """

    def _payload(
        self, state: dict, content: str = "Hello", run_id: str = "run-x"
    ) -> dict:
        return {
            "threadId": "test-thread",
            "runId": run_id,
            "tools": [],
            "context": [],
            "forwardedProps": {},
            "state": state,
            "messages": [{"id": "msg-1", "role": "user", "content": content}],
        }

    async def test_agent_run_streams_response(self, client: AsyncClient) -> None:
        from pydantic_ai.models.test import TestModel

        from src.agents import recipe_agent

        empty_state = {
            "document_text": None,
            "recipe": None,
            "current_step": 0,
            "scaled_servings": None,
            "checked_ingredients": [],
            "cooking_started": False,
        }

        with recipe_agent.override(model=TestModel()):
            response = await client.post(
                "/copilotkit/", json=self._payload(empty_state)
            )

        assert response.status_code == 200
        event_types = [e.get("type") for e in parse_sse_events(response.text)]
        assert "RUN_STARTED" in event_types

    async def test_agent_run_with_recipe_state(
        self, client: AsyncClient, sample_recipe: Recipe
    ) -> None:
        from pydantic_ai.models.test import TestModel

        from src.agents import recipe_agent

        state = {
            "document_text": None,
            "recipe": sample_recipe.model_dump(),
            "current_step": 0,
            "scaled_servings": None,
            "checked_ingredients": [],
            "cooking_started": False,
        }

        with recipe_agent.override(model=TestModel()):
            response = await client.post(
                "/copilotkit/",
                json=self._payload(state, content="What recipe is this?"),
            )

        assert response.status_code == 200


from tests.helpers import parse_sse_events  # noqa: E402


class TestToolCalling:
    """Tests for agent tool calling behavior.

    These tests use real API calls to verify:
    1. The agent calls tools when user requests changes
    2. Tools modify the recipe state correctly
    3. STATE_SNAPSHOT events are emitted with updated state

    Note: These tests make real OpenAI API calls because the pydantic-ai
    agent is created at module load time, making mocking difficult.
    """

    @pytest.mark.integration
    async def test_substitute_ingredient_tool_is_called(
        self, client: AsyncClient, sample_recipe: Recipe
    ) -> None:
        """
        When user asks to substitute an ingredient, the agent should:
        1. Call the substitute_ingredient tool
        2. Emit a STATE_SNAPSHOT with the modified recipe
        """
        response = await client.post(
            "/copilotkit/",
            json={
                "threadId": "test-tool-call",
                "runId": "run-tool-call",
                "tools": [],
                "context": [],
                "forwardedProps": {},
                "state": {
                    "document_text": None,
                    "recipe": sample_recipe.model_dump(),
                    "current_step": 0,
                    "scaled_servings": None,
                    "checked_ingredients": [],
                    "cooking_started": False,
                },
                "messages": [
                    {
                        "id": "msg-1",
                        "role": "user",
                        "content": "Please substitute parmesan with pecorino",
                    }
                ],
            },
        )

        assert response.status_code == 200

        events = parse_sse_events(response.text)
        event_types = [e.get("type") for e in events]

        # Verify tool was called and state was updated
        assert "TOOL_CALL_START" in event_types, "Tool should be called"
        assert "STATE_SNAPSHOT" in event_types, "State should be updated"

        # Find the state snapshot event
        state_event = next(e for e in events if e.get("type") == "STATE_SNAPSHOT")
        snapshot = state_event["snapshot"]

        # Verify the substitution was made
        ingredient_names = [i["name"] for i in snapshot["recipe"]["ingredients"]]
        assert "parmesan" not in ingredient_names, "parmesan should be replaced"
        assert "pecorino" in ingredient_names, "pecorino should be added"

    @pytest.mark.integration
    async def test_scale_recipe_tool_is_called(
        self, client: AsyncClient, sample_recipe: Recipe
    ) -> None:
        """
        When user asks to scale a recipe, the agent should:
        1. Call the scale_recipe tool
        2. Emit a STATE_SNAPSHOT with scaled quantities
        """
        response = await client.post(
            "/copilotkit/",
            json={
                "threadId": "test-scale",
                "runId": "run-scale",
                "tools": [],
                "context": [],
                "forwardedProps": {},
                "state": {
                    "document_text": None,
                    "recipe": sample_recipe.model_dump(),
                    "current_step": 0,
                    "scaled_servings": None,
                    "checked_ingredients": [],
                    "cooking_started": False,
                },
                "messages": [
                    {
                        "id": "msg-1",
                        "role": "user",
                        "content": "Double the recipe please",
                    }
                ],
            },
        )

        assert response.status_code == 200

        events = parse_sse_events(response.text)
        event_types = [e.get("type") for e in events]

        # Verify tool was called
        assert "TOOL_CALL_START" in event_types

        # Verify it was the scale_recipe tool
        tool_start = next(e for e in events if e.get("type") == "TOOL_CALL_START")
        assert tool_start["toolCallName"] == "scale_recipe"

        # Verify state snapshot event was emitted
        assert "STATE_SNAPSHOT" in event_types
        state_event = next(e for e in events if e.get("type") == "STATE_SNAPSHOT")
        snapshot = state_event["snapshot"]

        # The recipe should be scaled to 8 servings
        assert snapshot["recipe"]["servings"] == 8
        assert snapshot["scaled_servings"] == 8

        # Ingredient quantities should be doubled (original was 4 servings)
        spaghetti = next(
            i for i in snapshot["recipe"]["ingredients"] if i["name"] == "spaghetti"
        )
        assert spaghetti["quantity"] == 800  # Was 400g, now doubled


class TestRecipeScaling:
    """Tests for Recipe.scale() method."""

    def test_scale_doubles_servings(self, sample_recipe: Recipe) -> None:
        """Scaling to double servings doubles ingredient quantities."""
        scaled = sample_recipe.scale(8)

        assert scaled.servings == 8
        assert scaled.original_servings == 4

        # Check specific ingredients
        spaghetti = next(i for i in scaled.ingredients if i.name == "spaghetti")
        assert spaghetti.quantity == 800  # 400 * 2

        garlic = next(i for i in scaled.ingredients if i.name == "garlic")
        assert garlic.quantity == 6  # 3 * 2

    def test_scale_halves_servings(self, sample_recipe: Recipe) -> None:
        """Scaling to half servings halves ingredient quantities."""
        scaled = sample_recipe.scale(2)

        assert scaled.servings == 2
        assert scaled.original_servings == 4

        spaghetti = next(i for i in scaled.ingredients if i.name == "spaghetti")
        assert spaghetti.quantity == 200  # 400 / 2

    def test_scale_preserves_original(self, sample_recipe: Recipe) -> None:
        """Scaling preserves original_servings through multiple scales."""
        scaled_once = sample_recipe.scale(8)
        scaled_twice = scaled_once.scale(4)

        assert scaled_twice.servings == 4
        assert scaled_twice.original_servings == 4  # Original preserved

    def test_scale_to_same_servings_returns_copy(self, sample_recipe: Recipe) -> None:
        """Scaling to the same servings returns a copy, not the original instance."""
        scaled = sample_recipe.scale(4)

        assert scaled is not sample_recipe
        assert scaled.servings == sample_recipe.servings

    def test_scale_rejects_zero_servings(self, sample_recipe: Recipe) -> None:
        from pydantic import ValidationError

        with pytest.raises((ValueError, ValidationError)):
            sample_recipe.scale(0)

    def test_scale_rejects_negative_servings(self, sample_recipe: Recipe) -> None:
        from pydantic import ValidationError

        with pytest.raises((ValueError, ValidationError)):
            sample_recipe.scale(-2)

    def test_scale_handles_none_quantity(self) -> None:
        """Scaling handles ingredients with None quantity."""
        recipe = Recipe(
            title="Test",
            servings=2,
            ingredients=[
                Ingredient(
                    name="salt", quantity=None, unit="to taste", category="spice"
                ),
                Ingredient(name="flour", quantity=100, unit="g", category="pantry"),
            ],
            steps=[RecipeStep(step_number=1, instruction="Mix")],
        )

        scaled = recipe.scale(4)

        salt = next(i for i in scaled.ingredients if i.name == "salt")
        assert salt.quantity is None  # Still None

        flour = next(i for i in scaled.ingredients if i.name == "flour")
        assert flour.quantity == 200


class TestRecipeSubstitution:
    """Tests for Recipe.substitute_ingredient() method."""

    def test_substitute_replaces_ingredient(self, sample_recipe: Recipe) -> None:
        """Substitution replaces ingredient by name."""
        modified = sample_recipe.substitute_ingredient(
            original_name="parmesan",
            substitute_name="pecorino romano",
        )

        names = [i.name for i in modified.ingredients]
        assert "parmesan" not in names
        assert "pecorino romano" in names

        # Quantity should be preserved
        pecorino = next(i for i in modified.ingredients if i.name == "pecorino romano")
        assert pecorino.quantity == 50
        assert pecorino.unit == "g"

    def test_substitute_with_new_quantity(self, sample_recipe: Recipe) -> None:
        """Substitution can change quantity and unit."""
        modified = sample_recipe.substitute_ingredient(
            original_name="olive oil",
            substitute_name="butter",
            substitute_quantity=4,
            substitute_unit="tbsp",
        )

        butter = next(i for i in modified.ingredients if i.name == "butter")
        assert butter.quantity == 4
        assert butter.unit == "tbsp"

    def test_substitute_case_insensitive(self, sample_recipe: Recipe) -> None:
        """Substitution is case-insensitive."""
        modified = sample_recipe.substitute_ingredient(
            original_name="GARLIC",
            substitute_name="shallots",
        )

        names = [i.name for i in modified.ingredients]
        assert "garlic" not in names
        assert "shallots" in names

    def test_substitute_nonexistent_does_nothing(self, sample_recipe: Recipe) -> None:
        """Substituting nonexistent ingredient returns unchanged recipe."""
        original_names = [i.name for i in sample_recipe.ingredients]

        modified = sample_recipe.substitute_ingredient(
            original_name="unicorn tears",
            substitute_name="water",
        )

        modified_names = [i.name for i in modified.ingredients]
        assert original_names == modified_names

    def test_substitute_updates_step_instructions(self, sample_recipe: Recipe) -> None:
        """Step text should reflect the substitute name, not just the ingredient list."""
        modified = sample_recipe.substitute_ingredient(
            original_name="parmesan",
            substitute_name="pecorino romano",
        )

        instructions = " ".join(s.instruction for s in modified.steps)
        assert "parmesan" not in instructions.lower()
        assert "pecorino romano" in instructions

    def test_substitute_in_steps_is_case_insensitive(self) -> None:
        """Steps containing the ingredient in a different case still get updated."""
        recipe = Recipe(
            title="Test",
            servings=2,
            ingredients=[Ingredient(name="butter", quantity=50, unit="g")],
            steps=[RecipeStep(step_number=1, instruction="Melt the Butter in a pan")],
        )

        modified = recipe.substitute_ingredient(
            original_name="butter",
            substitute_name="olive oil",
        )

        assert modified.steps[0].instruction == "Melt the olive oil in a pan"

    def test_substitute_leaves_steps_untouched_when_not_mentioned(
        self, sample_recipe: Recipe
    ) -> None:
        """If the original ingredient name is not in any step, steps stay identical."""
        original_steps = [s.instruction for s in sample_recipe.steps]

        modified = sample_recipe.substitute_ingredient(
            original_name="spaghetti",
            substitute_name="penne",
        )

        modified_steps = [s.instruction for s in modified.steps]
        assert modified_steps == original_steps

    def test_substitute_multi_word_ingredient_updates_steps(self) -> None:
        """Multi-word ingredient names are replaced as a whole phrase."""
        recipe = Recipe(
            title="Test",
            servings=2,
            ingredients=[
                Ingredient(name="Roma tomatoes", quantity=4, unit="medium"),
            ],
            steps=[
                RecipeStep(step_number=1, instruction="Slice the Roma tomatoes thinly"),
            ],
        )

        modified = recipe.substitute_ingredient(
            original_name="Roma tomatoes",
            substitute_name="cherry tomatoes",
        )

        assert modified.steps[0].instruction == "Slice the cherry tomatoes thinly"

    def test_substitute_rewrites_timer_label_via_regex(self) -> None:
        """Timer labels that contain the ingredient name are also rewritten."""
        recipe = Recipe(
            title="Test",
            servings=2,
            ingredients=[Ingredient(name="chicken", quantity=500, unit="g")],
            steps=[
                RecipeStep(
                    step_number=1,
                    instruction="Marinate the chicken for 10 minutes",
                    timer_label="Marinate Chicken",
                )
            ],
        )

        modified = recipe.substitute_ingredient(
            original_name="chicken",
            substitute_name="pork",
        )

        assert modified.steps[0].timer_label == "Marinate pork"

    def test_substitute_does_not_match_inside_other_words(self) -> None:
        """Word-boundary match: 'oil' must not replace inside 'boil' or 'foil'."""
        recipe = Recipe(
            title="Test",
            servings=2,
            ingredients=[Ingredient(name="oil", quantity=1, unit="tbsp")],
            steps=[
                RecipeStep(step_number=1, instruction="Boil water and add oil"),
                RecipeStep(step_number=2, instruction="Cover with foil"),
            ],
        )

        modified = recipe.substitute_ingredient(
            original_name="oil",
            substitute_name="ghee",
        )

        assert modified.steps[0].instruction == "Boil water and add ghee"
        assert modified.steps[1].instruction == "Cover with foil"


class TestRecipeContext:
    """Tests for RecipeContext model."""

    def test_default_values(self) -> None:
        """RecipeContext has sensible defaults."""
        ctx = RecipeContext()

        assert ctx.document_text is None
        assert ctx.recipe is None
        assert ctx.current_step == 0
        assert ctx.scaled_servings is None
        assert ctx.checked_ingredients == []
        assert ctx.cooking_started is False

    def test_model_dump_serialization(self, sample_state: RecipeContext) -> None:
        """RecipeContext serializes properly for CopilotKit."""
        data = sample_state.model_dump()

        assert "document_text" in data
        assert "recipe" in data
        assert "current_step" in data
        assert data["recipe"]["title"] == "Pasta al Pomodoro"


class TestHealthEndpoint:
    """Tests for health check endpoint."""

    async def test_health_returns_ok(self, client: AsyncClient) -> None:
        """Health endpoint returns healthy status."""
        response = await client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "recipe-companion"


class TestFullRecipeFlow:
    """
    End-to-end flow tests for the Recipe Companion.

    These tests simulate a complete user journey using real API calls:
    1. Scale the recipe
    2. Substitute ingredients
    3. Verify state changes propagate correctly

    Note: These tests make real OpenAI API calls because the pydantic-ai
    agent is created at module load time, making mocking difficult.
    """

    @pytest.mark.integration
    async def test_full_flow_scale_then_substitute(
        self, client: AsyncClient, sample_recipe: Recipe
    ) -> None:
        """
        Complete flow test: Scale → Substitute → Verify.

        This test simulates a real user session where they:
        1. Start with a parsed recipe (4 servings)
        2. Ask to double the recipe (8 servings)
        3. Ask to substitute parmesan with pecorino
        4. Verify all changes are reflected in the state
        """
        # === STEP 1: Scale the recipe (double it) ===
        scale_response = await client.post(
            "/copilotkit/",
            json={
                "threadId": "flow-test-001",
                "runId": "run-scale-001",
                "tools": [],
                "context": [],
                "forwardedProps": {},
                "state": {
                    "document_text": None,
                    "recipe": sample_recipe.model_dump(),
                    "current_step": 0,
                    "scaled_servings": None,
                    "checked_ingredients": [],
                    "cooking_started": False,
                },
                "messages": [
                    {
                        "id": "msg-1",
                        "role": "user",
                        "content": "Double the recipe please",
                    }
                ],
            },
        )

        assert scale_response.status_code == 200

        scale_events = parse_sse_events(scale_response.text)
        scale_event_types = [e.get("type") for e in scale_events]

        # Verify scale tool was called
        assert "TOOL_CALL_START" in scale_event_types
        scale_tool_calls = [
            e for e in scale_events if e.get("type") == "TOOL_CALL_START"
        ]
        assert scale_tool_calls[0]["toolCallName"] == "scale_recipe"

        # Verify state was updated
        assert "STATE_SNAPSHOT" in scale_event_types
        state_event = next(e for e in scale_events if e.get("type") == "STATE_SNAPSHOT")
        scaled_state = state_event["snapshot"]

        assert scaled_state["recipe"]["servings"] == 8
        assert scaled_state["scaled_servings"] == 8

        # Verify ingredients were doubled
        spaghetti = next(
            i for i in scaled_state["recipe"]["ingredients"] if i["name"] == "spaghetti"
        )
        assert spaghetti["quantity"] == 800  # Was 400, now 800

        garlic = next(
            i for i in scaled_state["recipe"]["ingredients"] if i["name"] == "garlic"
        )
        assert garlic["quantity"] == 6  # Was 3, now 6

        # === STEP 2: Substitute an ingredient ===
        sub_response = await client.post(
            "/copilotkit/",
            json={
                "threadId": "flow-test-001",
                "runId": "run-sub-001",
                "tools": [],
                "context": [],
                "forwardedProps": {},
                "state": scaled_state,  # Use state from previous step
                "messages": [
                    {
                        "id": "msg-1",
                        "role": "user",
                        "content": "Double the recipe please",
                    },
                    {
                        "id": "msg-2",
                        "role": "assistant",
                        "content": "I've doubled the recipe to serve 8 people.",
                    },
                    {
                        "id": "msg-3",
                        "role": "user",
                        "content": "Can you substitute parmesan with pecorino romano?",
                    },
                ],
            },
        )

        assert sub_response.status_code == 200

        sub_events = parse_sse_events(sub_response.text)
        sub_event_types = [e.get("type") for e in sub_events]

        # Verify substitute tool was called
        assert "TOOL_CALL_START" in sub_event_types
        sub_tool_calls = [e for e in sub_events if e.get("type") == "TOOL_CALL_START"]
        assert sub_tool_calls[0]["toolCallName"] == "substitute_ingredient"

        # Verify state was updated
        assert "STATE_SNAPSHOT" in sub_event_types
        final_state_event = next(
            e for e in sub_events if e.get("type") == "STATE_SNAPSHOT"
        )
        final_state = final_state_event["snapshot"]

        # Verify parmesan was replaced with pecorino
        ingredient_names = [i["name"] for i in final_state["recipe"]["ingredients"]]
        assert "parmesan" not in ingredient_names
        assert any("pecorino" in name.lower() for name in ingredient_names)

        # Recipe should still be at 8 servings
        assert final_state["recipe"]["servings"] == 8

    @pytest.mark.integration
    async def test_flow_scale_then_scale_again(
        self, client: AsyncClient, sample_recipe: Recipe
    ) -> None:
        """
        Test multiple scaling operations in sequence.

        Verifies that:
        1. First scale (4 → 8 servings) works
        2. Second scale (8 → 2 servings) works
        3. Original servings is preserved throughout
        """
        # First scale: 4 → 8
        resp1 = await client.post(
            "/copilotkit/",
            json={
                "threadId": "scale-test",
                "runId": "run-scale-1",
                "tools": [],
                "context": [],
                "forwardedProps": {},
                "state": {
                    "document_text": None,
                    "recipe": sample_recipe.model_dump(),
                    "current_step": 0,
                    "scaled_servings": None,
                    "checked_ingredients": [],
                    "cooking_started": False,
                },
                "messages": [
                    {
                        "id": "msg-1",
                        "role": "user",
                        "content": "Double it to 8 servings",
                    }
                ],
            },
        )

        assert resp1.status_code == 200
        events1 = parse_sse_events(resp1.text)

        state1_event = next(e for e in events1 if e.get("type") == "STATE_SNAPSHOT")
        state1 = state1_event["snapshot"]

        assert state1["recipe"]["servings"] == 8
        assert state1["recipe"]["original_servings"] == 4

        # Second scale: 8 → 2
        resp2 = await client.post(
            "/copilotkit/",
            json={
                "threadId": "scale-test",
                "runId": "run-scale-2",
                "tools": [],
                "context": [],
                "forwardedProps": {},
                "state": state1,
                "messages": [
                    {
                        "id": "msg-1",
                        "role": "user",
                        "content": "Actually make it for 2 people",
                    }
                ],
            },
        )

        assert resp2.status_code == 200
        events2 = parse_sse_events(resp2.text)

        state2_event = next(e for e in events2 if e.get("type") == "STATE_SNAPSHOT")
        state2 = state2_event["snapshot"]

        assert state2["recipe"]["servings"] == 2
        assert state2["recipe"]["original_servings"] == 4  # Still preserved

        # Verify ingredients scaled correctly (original 400g / 2 = 200g)
        spaghetti = next(
            i for i in state2["recipe"]["ingredients"] if i["name"] == "spaghetti"
        )
        assert spaghetti["quantity"] == 200

    @pytest.mark.integration
    async def test_flow_multiple_substitutions(
        self, client: AsyncClient, sample_recipe: Recipe
    ) -> None:
        """
        Test multiple ingredient substitutions in sequence.

        Verifies that:
        1. First substitution works
        2. Second substitution works
        3. Both changes are reflected in final state
        """
        # First substitution: parmesan → pecorino
        resp1 = await client.post(
            "/copilotkit/",
            json={
                "threadId": "sub-test",
                "runId": "run-sub-1",
                "tools": [],
                "context": [],
                "forwardedProps": {},
                "state": {
                    "document_text": None,
                    "recipe": sample_recipe.model_dump(),
                    "current_step": 0,
                    "scaled_servings": None,
                    "checked_ingredients": [],
                    "cooking_started": False,
                },
                "messages": [
                    {
                        "id": "msg-1",
                        "role": "user",
                        "content": "Replace parmesan with pecorino",
                    }
                ],
            },
        )

        assert resp1.status_code == 200
        events1 = parse_sse_events(resp1.text)

        state1_event = next(e for e in events1 if e.get("type") == "STATE_SNAPSHOT")
        state1 = state1_event["snapshot"]

        names1 = [i["name"] for i in state1["recipe"]["ingredients"]]
        assert "parmesan" not in names1
        assert "pecorino" in names1

        # Second substitution: olive oil → butter
        resp2 = await client.post(
            "/copilotkit/",
            json={
                "threadId": "sub-test",
                "runId": "run-sub-2",
                "tools": [],
                "context": [],
                "forwardedProps": {},
                "state": state1,
                "messages": [
                    {
                        "id": "msg-1",
                        "role": "user",
                        "content": "And replace olive oil with butter",
                    }
                ],
            },
        )

        assert resp2.status_code == 200
        events2 = parse_sse_events(resp2.text)

        state2_event = next(e for e in events2 if e.get("type") == "STATE_SNAPSHOT")
        state2 = state2_event["snapshot"]

        # Verify both substitutions are in final state
        names2 = [i["name"] for i in state2["recipe"]["ingredients"]]
        assert "parmesan" not in names2
        assert "pecorino" in names2
        assert "olive oil" not in names2
        assert "butter" in names2

    @pytest.mark.integration
    async def test_flow_no_recipe_loaded(self, client: AsyncClient) -> None:
        """
        Test that agent handles missing recipe gracefully.

        When user asks to modify a recipe but none is loaded,
        the agent should respond appropriately (may or may not call tools).
        """
        response = await client.post(
            "/copilotkit/",
            json={
                "threadId": "no-recipe-test",
                "runId": "run-no-recipe",
                "tools": [],
                "context": [],
                "forwardedProps": {},
                "state": {
                    "document_text": None,
                    "recipe": None,
                    "current_step": 0,
                    "scaled_servings": None,
                    "checked_ingredients": [],
                    "cooking_started": False,
                },
                "messages": [
                    {"id": "msg-1", "role": "user", "content": "Double the recipe"}
                ],
            },
        )

        assert response.status_code == 200

        events = parse_sse_events(response.text)
        event_types = [e.get("type") for e in events]

        # Should complete the run (may or may not call tools)
        assert "RUN_STARTED" in event_types


class TestCorrectnessFixes:
    """Tests for the correctness fixes in the backlog."""

    # ---- /upload error handling ----

    async def test_upload_rejects_malformed_pdf_with_422(
        self, client: AsyncClient
    ) -> None:
        """A bad PDF should return 422, not a 500 with a traceback."""
        files = {
            "file": ("broken.pdf", BytesIO(b"not a real pdf"), "application/pdf"),
        }
        response = await client.post("/upload", files=files)
        assert response.status_code == 422

    async def test_upload_returns_422_when_parsing_returns_none(
        self, client: AsyncClient
    ) -> None:
        """If the parser gives up, return 422 instead of shipping recipe=None."""
        files = {"file": ("x.txt", BytesIO(b"gibberish"), "text/plain")}

        with patch(
            "src.main.parse_recipe_from_text", new_callable=AsyncMock
        ) as mock_parse:
            mock_parse.return_value = None
            response = await client.post("/upload", files=files)

        assert response.status_code == 422

    # ---- scale_recipe tool guards ----

    async def test_scale_tool_rejects_zero_servings(
        self, sample_recipe: Recipe
    ) -> None:
        from src.agents import scale_recipe

        ctx = MagicMock()
        ctx.deps.state = RecipeContext(recipe=sample_recipe)
        result = scale_recipe(ctx, 0)
        assert isinstance(result, str)
        assert "servings" in result.lower()

    async def test_scale_tool_rejects_negative_servings(
        self, sample_recipe: Recipe
    ) -> None:
        from src.agents import scale_recipe

        ctx = MagicMock()
        ctx.deps.state = RecipeContext(recipe=sample_recipe)
        result = scale_recipe(ctx, -3)
        assert isinstance(result, str)
        assert "servings" in result.lower()

    # ---- update_cooking_progress out-of-bounds ----

    async def test_update_cooking_progress_rejects_out_of_bounds(
        self, sample_recipe: Recipe
    ) -> None:
        from src.agents import update_cooking_progress

        ctx = MagicMock()
        ctx.deps.state = RecipeContext(recipe=sample_recipe)
        result = update_cooking_progress(ctx, current_step=99)
        assert isinstance(result, str)
        assert "step" in result.lower()

    async def test_update_cooking_progress_rejects_negative_step(
        self, sample_recipe: Recipe
    ) -> None:
        from src.agents import update_cooking_progress

        ctx = MagicMock()
        ctx.deps.state = RecipeContext(recipe=sample_recipe)
        result = update_cooking_progress(ctx, current_step=-1)
        assert isinstance(result, str)
        assert "step" in result.lower()

    async def test_update_cooking_progress_advances_step(
        self, sample_recipe: Recipe
    ) -> None:
        from ag_ui.core import StateSnapshotEvent

        from src.agents import update_cooking_progress

        state = RecipeContext(recipe=sample_recipe)
        ctx = MagicMock()
        ctx.deps.state = state

        result = update_cooking_progress(ctx, current_step=2)

        assert isinstance(result, StateSnapshotEvent)
        assert state.current_step == 2

    async def test_update_cooking_progress_toggles_cooking_started(
        self, sample_recipe: Recipe
    ) -> None:
        from ag_ui.core import StateSnapshotEvent

        from src.agents import update_cooking_progress

        state = RecipeContext(recipe=sample_recipe, cooking_started=False)
        ctx = MagicMock()
        ctx.deps.state = state

        result = update_cooking_progress(ctx, cooking_started=True)

        assert isinstance(result, StateSnapshotEvent)
        assert state.cooking_started is True

    # ---- substitute preserves metadata ----

    def test_substitute_clears_substitutes_on_new_ingredient(self) -> None:
        """New ingredient starts with an empty substitutes list.

        The original's substitutes are usually variants of the thing being replaced
        (e.g. 'chicken breast' as a cut of chicken) — carrying them over to the
        substitute produces nonsense like pork listing 'chicken breast' as an
        alternative.
        """
        recipe = Recipe(
            title="Test",
            servings=2,
            ingredients=[
                Ingredient(
                    name="chicken thigh",
                    quantity=500,
                    unit="g",
                    substitutes=["chicken breast", "chicken tenderloin"],
                )
            ],
            steps=[RecipeStep(step_number=1, instruction="Sauté the chicken")],
        )

        modified = recipe.substitute_ingredient(
            original_name="chicken thigh",
            substitute_name="pork",
        )

        new_ing = next(i for i in modified.ingredients if i.name == "pork")
        assert new_ing.substitutes == []

    # ---- find_and_substitute degraded-match signal ----

    async def test_find_and_substitute_signals_fallback(
        self, sample_recipe: Recipe
    ) -> None:
        """When the LLM fails and exact match saves us, the result must flag it."""
        from src.agents import find_and_substitute

        with patch("src.agents.get_substitution_agent") as mock_get_agent:
            mock_agent = AsyncMock()
            mock_agent.run.side_effect = Exception("LLM API error")
            mock_get_agent.return_value = mock_agent

            result = await find_and_substitute(
                sample_recipe, "olive oil", "sunflower oil"
            )

        assert result.matched_ingredient == "olive oil"
        combined = f"{result.cooking_tip or ''} {result.suggestion or ''}".lower()
        assert "ai" in combined or "fallback" in combined or "unavailable" in combined

    # ---- build_model Claude support ----

    def test_build_model_routes_claude_to_anthropic(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
        from pydantic_ai.models.anthropic import AnthropicModel

        from src.agents import build_model

        model = build_model("claude-sonnet-4-5")
        assert isinstance(model, AnthropicModel)

    def test_build_model_routes_gpt_to_openai(self) -> None:
        from pydantic_ai.models.openai import OpenAIChatModel

        from src.agents import build_model

        assert isinstance(build_model("gpt-4o"), OpenAIChatModel)

    def test_build_model_routes_o1_to_openai(self) -> None:
        from pydantic_ai.models.openai import OpenAIChatModel

        from src.agents import build_model

        assert isinstance(build_model("o1-mini"), OpenAIChatModel)

    def test_build_model_routes_gemini_to_google(self) -> None:
        from pydantic_ai.models.google import GoogleModel

        from src.agents import build_model

        assert isinstance(build_model("gemini-2.5-flash"), GoogleModel)

    def test_build_model_raises_on_unknown_prefix(self) -> None:
        from src.agents import build_model

        with pytest.raises(ValueError, match="Unknown LLM_MODEL prefix"):
            build_model("mistral-large")

    def test_build_model_strips_quoted_env_value(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Docker's env_file passes values literally — quotes must be stripped."""
        import importlib

        monkeypatch.setenv("LLM_MODEL", '"gpt-4o"')
        from src import agents

        importlib.reload(agents)
        assert agents.MODEL_NAME == "gpt-4o"

    # ---- pydantic validators ----

    def test_recipe_rejects_empty_title(self) -> None:
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            Recipe(
                title="",
                servings=2,
                ingredients=[Ingredient(name="x", quantity=1)],
                steps=[RecipeStep(step_number=1, instruction="do x")],
            )

    def test_recipe_rejects_zero_servings(self) -> None:
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            Recipe(
                title="t",
                servings=0,
                ingredients=[Ingredient(name="x", quantity=1)],
                steps=[RecipeStep(step_number=1, instruction="do x")],
            )

    def test_recipe_rejects_empty_ingredients(self) -> None:
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            Recipe(
                title="t",
                servings=2,
                ingredients=[],
                steps=[RecipeStep(step_number=1, instruction="do x")],
            )

    def test_recipe_rejects_empty_steps(self) -> None:
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            Recipe(
                title="t",
                servings=2,
                ingredients=[Ingredient(name="x", quantity=1)],
                steps=[],
            )

    def test_ingredient_rejects_empty_name(self) -> None:
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            Ingredient(name="", quantity=1)
