"use client";

import { useRecipeContext } from "@/lib/RecipeContext";
import { useState } from "react";

export function StepsModal(): React.JSX.Element {
  const { context } = useRecipeContext();
  const steps = context.state?.recipe?.steps || [];
  const [currentStep, setCurrentStep] = useState(0);

  return (
    <div
      id="steps-modal"
      className="overlay modal overlay-open:opacity-100 overlay-open:duration-300 hidden"
      role="dialog"
      tabIndex={-1}
    >
      <div className="modal-dialog max-w-none">
        <div className="modal-content h-full max-h-none justify-between">
          <div className="modal-header">
            <ul className="relative flex flex-row gap-x-2 w-full">
              {steps.map((step, index) => {
                const isActive = index === currentStep;
                const isCompleted = index < currentStep;

                return (
                  <li
                    key={index}
                    className="group flex flex-1 shrink basis-0 items-center gap-x-2"
                  >
                    <span className="min-h-7.5 min-w-7.5 inline-flex items-center align-middle text-md">
                      <span
                        className={`${isActive || isCompleted ? "text-bg-success" : "text-bg-primary shadow-sm"} shadow-base-300/20 text-bg-soft-neutral flex size-7.5 shrink-0 items-center justify-center rounded-full font-bold`}
                      >
                        {isCompleted ? (
                          <span className="icon-[tabler--check] size-6 shrink-0" />
                        ) : (
                          <>{index + 1}</>
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
          <div className="modal-body grow flex flex-col items-center justify-center text-center">
            <div className="mt-5 grow">
              {steps.map((step, index) => (
                <div
                  key={index}
                  className={`flex h-full items-center justify-center p-4 ${index === currentStep ? "block" : "hidden"}`}
                >
                  <p className="text-4xl/loose text-center">
                    {step.instruction}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-5 w-full flex items-center justify-between gap-x-2">
              <button
                type="button"
                className="btn btn-primary btn-lg"
                disabled={currentStep === 0}
                onClick={() => setCurrentStep((prev) => prev - 1)}
              >
                <span className="icon-[tabler--chevron-left] text-primary-content rtl:rotate-180"></span>
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                disabled={currentStep === steps.length - 1}
                onClick={() => setCurrentStep((prev) => prev + 1)}
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
