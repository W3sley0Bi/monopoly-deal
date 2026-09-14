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
    },
    deploy: {
      startCommand: "./server_bin",
      preDeployCommand: null,
      sleepApplication: true,
    },
  });
  return project("miraculous-appreciation", {
    resources: [monopoly_deal],
  });
});
