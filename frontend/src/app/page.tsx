import { CopilotKit } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-core/v2";

export default function Page() {
  return (
    <main>
      <h1>Your App</h1>
      <CopilotKit runtimeUrl="http://localhost:8000/copilotkit">
        <CopilotSidebar />
      </CopilotKit>
    </main>
  );
}
