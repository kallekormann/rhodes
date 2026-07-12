/** Build a minimal valid PDF with N pages for Tika / ingest QA. */

function escapePdfString(value) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function pageContent(pageNumber) {
  const line = escapePdfString(`Rhodes library QA page ${pageNumber}. `.repeat(8).trim());
  const stream = `BT /F1 11 Tf 72 720 Td (${line}) Tj ET`;
  return { stream, length: Buffer.byteLength(stream, "utf8") };
}

export function buildTestPdf(pageCount = 1) {
  const pages = Math.max(1, Math.min(pageCount, 30));
  const fontObjId = 3 + pages * 2;
  const kidRefs = Array.from({ length: pages }, (_, i) => `${3 + i * 2} 0 R`).join(" ");

  const objects = [];
  const append = (body) => {
    objects.push(body);
  };

  append("<< /Type /Catalog /Pages 2 0 R >>");
  append(`<< /Type /Pages /Kids [${kidRefs}] /Count ${pages} >>`);

  for (let i = 0; i < pages; i += 1) {
    const contentObjId = 4 + i * 2;
    const { stream, length } = pageContent(i + 1);
    append(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjId} 0 R >> >> /Contents ${contentObjId} 0 R >>`,
    );
    append(`<< /Length ${length} >>\nstream\n${stream}\nendstream`);
  }

  append("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  const offsets = [];
  let body = "";
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(Buffer.byteLength(body, "utf8"));
    body += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(body, "utf8");
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += `${String(off).padStart(10, "0")} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(`%PDF-1.4\n${body}${xref}${trailer}`, "utf8");
}
