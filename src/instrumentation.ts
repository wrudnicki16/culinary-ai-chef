import { initLogger } from "braintrust";

export async function register() {
  initLogger({
    projectName: "culinary-ai-chef",
    apiKey: process.env.BRAINTRUST_API_KEY,
  });
}
