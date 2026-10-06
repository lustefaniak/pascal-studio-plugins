// `@pascal-app/editor` ships TypeScript sources, so importing it typechecks the
// editor too. This one subpath of pdfkit has no published types; typechecking only.
declare module 'pdfkit/js/pdfkit.standalone' {
  import PDFDocument from 'pdfkit'
  export default PDFDocument
}
