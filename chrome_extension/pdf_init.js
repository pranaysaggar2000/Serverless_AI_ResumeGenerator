
import * as pdfjsLib from './pdf.min.mjs';
window.pdfjsLib = pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.min.mjs';
