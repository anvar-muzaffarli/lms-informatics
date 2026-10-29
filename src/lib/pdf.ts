import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export { pdfjsLib }

export async function countPdfPages(file: File) {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const n = doc.numPages
  await doc.loadingTask.destroy()
  return n
}
