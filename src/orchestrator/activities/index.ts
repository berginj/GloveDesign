import * as df from "durable-functions";
import crawlSite from "./crawlSite";
import extractColors from "./extractColors";
import generateDesign from "./generateDesign";
import selectLogo from "./selectLogo";
import updateJobStage from "./updateJobStage";
import validateJob from "./validateJob";
import writeOutputs from "./writeOutputs";
import runWizard from "./runWizard";

export const validateJobActivity = df.app.activity("validateJob", { handler: validateJob });
export const crawlSiteActivity = df.app.activity("crawlSite", { handler: crawlSite });
export const selectLogoActivity = df.app.activity("selectLogo", { handler: selectLogo });
export const extractColorsActivity = df.app.activity("extractColors", { handler: extractColors });
export const generateDesignActivity = df.app.activity("generateDesign", { handler: generateDesign });
export const writeOutputsActivity = df.app.activity("writeOutputs", { handler: writeOutputs });
export const updateJobStageActivity = df.app.activity("updateJobStage", { handler: updateJobStage });
export const runWizardActivity = df.app.activity("runWizard", { handler: runWizard });
