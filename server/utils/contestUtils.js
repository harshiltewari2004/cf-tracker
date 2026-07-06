const DIVISION_RULES = [
  { label: "Educational", test: (n) => /educational/i.test(n) },

  { label: "Combined", test: (n) => /div\.?\s*1\s*[+,]\s*div\.?\s*2/i.test(n) },

  { label: "Global", test: (n) => /global\s*round/i.test(n) },

  { label: "Div3", test: (n) => /div\.?\s*3/i.test(n) },
  { label: "Div4", test: (n) => /div\.?\s*4/i.test(n) },
  { label: "Div2", test: (n) => /div\.?\s*2/i.test(n) },
  { label: "Div1", test: (n) => /div\.?\s*1/i.test(n) },
];

export const classifyDivision = (name) => {
  for (const rule of DIVISION_RULES) {
    if (rule.test(name)) return rule.label;
  }
  return "Unknown";
};

const STORED_AS = {
  Div2: "Div2",
  Combined: "Div 2",
};

export const toStoredDivision = (label) => STORED_AS[label] ?? null;
