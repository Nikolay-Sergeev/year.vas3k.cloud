const colors = ['red', 'orange', 'green', 'blue', 'yellow', 'purple', 'teal', 'pink'];
const textures = ['diagonal-stripes', 'polka-dots', 'square-net'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function validate(data) {
  if (!object(data) || !Number.isInteger(data.selectedYear) || data.selectedYear < 1900 || data.selectedYear > 2200 ||
      !object(data.dateCells) || !['Linear', 'Classic', 'Column'].includes(data.selectedView) ||
      ![...colors, ...textures].includes(data.selectedColorTexture)) throw Error('Invalid calendar settings');
  if (Object.keys(data.dateCells).length > 30000) throw Error('Too many calendar entries');
  for (const [key, cell] of Object.entries(data.dateCells)) {
    const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(key);
    if (!match || !object(cell)) throw Error('Invalid date entry');
    const [, y, m, d] = match.map(Number);
    const date = new Date(Date.UTC(y, m, d));
    if (y < 1900 || y > 2200 || date.getUTCFullYear() !== y || date.getUTCMonth() !== m || date.getUTCDate() !== d) throw Error('Invalid calendar date');
    if ((cell.color !== undefined && !colors.includes(cell.color)) ||
        (cell.texture !== undefined && !textures.includes(cell.texture)) ||
        (cell.customText !== undefined && (typeof cell.customText !== 'string' || cell.customText.length > 10000)) ||
        Object.keys(cell).some(k => !['color', 'texture', 'customText'].includes(k))) throw Error('Invalid calendar cell');
  }
  return data;
}
module.exports = { validate };
