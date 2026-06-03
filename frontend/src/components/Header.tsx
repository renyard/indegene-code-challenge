import Image from "next/image";
import logo from "../assets/logo.webp";

export function Header({
  showButtons = true,
  className = "",
}: {
  showButtons?: boolean;
  className?: string;
}): React.JSX.Element {
  return (
    <header
      className={`bg-gray-800 text-white p-4 flex items-center justify-between rounded-lg ${className}`}
    >
      <h1 className="flex w-fit flex-row items-center text-xl font-bold text-white">
        <Image
          src={logo}
          alt=""
          className="mr-2 h-8 w-8"
          width={32}
          height={32}
        />
        <span>Recipe Assistant</span>
      </h1>
      <div className="flex">
        <button
          type="button"
          className={`btn glass text-white ${showButtons ? "" : "invisible"}`}
          aria-haspopup="dialog"
          aria-expanded="false"
          aria-controls="reload-modal"
          data-overlay="#reload-modal"
        >
          New Recipe
        </button>

        <button
          type="button"
          className={`btn btn-primary ml-4 ${showButtons ? "" : "invisible"}`}
          aria-haspopup="dialog"
          aria-expanded="false"
          aria-controls="steps-modal"
          data-overlay="#steps-modal"
        >
          Start Cooking
        </button>

        <div
          id="reload-modal"
          className="overlay modal overlay-open:opacity-100 hidden overlay-open:duration-300"
          role="dialog"
          tabIndex={-1}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h3 className="modal-title">Start a New Recipe?</h3>
                <button
                  type="button"
                  className="btn btn-text btn-circle btn-xl absolute end-3 top-3"
                  aria-label="Close"
                  data-overlay="#reload-modal"
                >
                  <span className="icon-[tabler--x] size-8"></span>
                </button>
              </div>
              <div className="modal-body text-black dark:text-white">
                You'll lose your current recipe and chat history. Are you sure
                you want to start a new recipe?
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-soft btn-secondary"
                  data-overlay="#reload-modal"
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-error"
                  onClick={() => location.reload()}
                >
                  Start New Recipe
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
