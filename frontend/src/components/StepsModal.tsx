"use client";

import { useEffect } from "react";
import { useRecipeAgent } from "@/lib/useRecipeAgent";
import { FittedText } from "./FittedText";

export function StepsModal(): React.JSX.Element {
  const { agentState, setAgentState } = useRecipeAgent();
  const steps = agentState.recipe?.steps || [];
  const maxStepIndex = Math.max(steps.length - 1, 0);
  const currentStep = Math.min(
    Math.max(agentState.current_step, 0),
    maxStepIndex,
  );

  const updateCurrentStep = (nextStep: number) => {
    const boundedStep = Math.min(Math.max(nextStep, 0), maxStepIndex);

    setAgentState((prevState) => ({
      ...prevState,
      current_step: boundedStep,
    }));
  };

  useEffect(() => {
    const modal = document.getElementById("steps-modal");

    const markCookingStarted = () => {
      setAgentState((prevState) => {
        if (prevState.cooking_started) {
          return prevState;
        }

        return {
          ...prevState,
          cooking_started: true,
        };
      });
    };

    modal?.addEventListener("open.overlay", markCookingStarted);

    return () => {
      modal?.removeEventListener("open.overlay", markCookingStarted);
    };
  }, [setAgentState]);

  return (
    <div
      id="steps-modal"
      className="overlay modal overlay-open:opacity-100 overlay-open:duration-300 hidden"
      role="dialog"
      tabIndex={-1}
    >
      <div className="modal-dialog h-full min-h-0 max-w-none">
        <div className="modal-content h-full min-h-0 max-h-none justify-between overflow-hidden">
          <div className="modal-header">
            <ul className="relative flex flex-row gap-x-2 w-full">
              {steps.map((step, index) => {
                const isActive = index === currentStep;
                const isCompleted = index < currentStep;

                return (
                  <li
                    key={step.step_number}
                    className="group flex flex-1 shrink basis-0 items-center gap-x-2"
                  >
                    <span className="min-h-7.5 min-w-7.5 inline-flex items-center align-middle text-md">
                      <span
                        className={`${isActive || isCompleted ? "text-bg-success" : "text-bg-primary shadow-sm"} shadow-base-300/20 text-bg-soft-neutral flex size-7.5 shrink-0 items-center justify-center rounded-full font-bold`}
                      >
                        {isCompleted ? (
                          <span className="icon-[tabler--check] size-6 shrink-0" />
                        ) : (
                          index + 1
                        )}
                      </span>
                    </span>
                    <div className="bg-neutral/20 h-px w-full flex-1 group-last:hidden"></div>
                  </li>
                );
              })}
            </ul>

            <button
              type="button"
              className="btn btn-text btn-circle btn-xl absolute end-3 top-3"
              aria-label="Close"
              data-overlay="#steps-modal"
            >
              <span className="icon-[tabler--x] size-8"></span>
            </button>
          </div>
          <div className="modal-body flex min-h-0 grow flex-col items-center overflow-hidden text-center">
            <h2 className="text-2xl font-bold mt-5 mb-4">
              Step {currentStep + 1} of {steps.length}
            </h2>
            <div className="divider" />
            <div className="min-h-0 w-full flex-1 overflow-hidden">
              {steps.map((step, index) => {
                if (index === currentStep) {
                  return (
                    <div
                      key={step.step_number}
                      className="flex h-full min-h-0 w-full items-center justify-center p-4"
                    >
                      <FittedText>{step.instruction}</FittedText>
                    </div>
                  );
                }
                return null;
              })}
            </div>
            <div className="mt-5 w-full flex items-center justify-between gap-x-2">
              <button
                type="button"
                className="btn btn-primary btn-lg"
                disabled={steps.length === 0 || currentStep === 0}
                onClick={() => updateCurrentStep(currentStep - 1)}
              >
                <span className="icon-[tabler--chevron-left] text-primary-content rtl:rotate-180"></span>
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                disabled={
                  steps.length === 0 || currentStep === steps.length - 1
                }
                onClick={() => updateCurrentStep(currentStep + 1)}
              >
                Next
                <span className="icon-[tabler--chevron-right] text-primary-content rtl:rotate-180"></span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
