let cached;

export async function loadPrepLibrary() {
  if (!cached) cached = fetch('./data/prep-library.json').then((response) => {
    if (!response.ok) throw new Error('The complete prep library could not be loaded.');
    return response.json();
  });
  return cached;
}

export function searchPrepLines(library, query) {
  const words = String(query).trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return library.modules.flatMap((module) => module.lines.map((line) => ({ ...line, moduleId: module.id, moduleTitle: module.title })))
    .filter((line) => words.every((word) => line.text.toLowerCase().includes(word)));
}

export function pagePrepLines(lines, requestedPage = 1, size = 250) {
  const pages = Math.max(1, Math.ceil(lines.length / size));
  const page = Math.min(pages, Math.max(1, Number(requestedPage) || 1));
  return { items: lines.slice((page - 1) * size, page * size), page, pages };
}
