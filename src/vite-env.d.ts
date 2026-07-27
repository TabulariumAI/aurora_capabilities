declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}

declare module "pdfjs-dist/build/pdf.worker.mjs?url" {
  const url: string;
  export default url;
}
