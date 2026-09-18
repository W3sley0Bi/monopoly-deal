import { defineRailway, project, service, github } from "railway/iac";

// Last resort for a per-service CaC repo. Prefer one .railway file for the
// project and drop this if you later combine services into that file.
export const partial = "monopoly-deal";

export default defineRailway(() => {
  const monopoly_deal = service("monopoly-deal", {
    source: github("W3sley0Bi/monopoly-deal", { rootDirectory: "/" }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "Dockerfile",
      // The image holds only the Go server and the mobile-client web build;
      // edits to the retired frontend/ or to docs should not redeploy it.
      watchPatterns: ["backend/**", "mobile-client/**", "Dockerfile", ".dockerignore"],
    },
    deploy: {
      startCommand: "./server_bin",
      preDeployCommand: null,
      healthcheckPath: "/",
      sleepApplication: true,
    },
    variables: {
      // Baked into the web bundle at build time (see Dockerfile); keep it in
      // step with mobile-client/.env.prod and the service's public domain.
      EXPO_PUBLIC_SERVER_URL: "wss://monopoly-deal-game.up.railway.app/ws",
    },
  });
  return project("miraculous-appreciation", {
    resources: [monopoly_deal],
  });
});
