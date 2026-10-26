// Delade konstanter och uppräkningar som används av både klient och server.

export const DIFFICULTIES = {
  beginner: { id: 'beginner', label: 'Nybörjare', suspects: 3, guidance: 'high' },
  normal: { id: 'normal', label: 'Normal', suspects: 4, guidance: 'medium' },
  hard: { id: 'hard', label: 'Svår', suspects: 5, guidance: 'low' },
  expert: { id: 'expert', label: 'Expert', suspects: 6, guidance: 'none' },
};

export const CASE_TYPES = {
  murder: 'Mordgåta',
  missing: 'Försvunnen person',
  suspicious_death: 'Misstänkt dödsfall',
  cold_case: 'Kallt fall',
  connected: 'Sammanhängande kriminalfall',
};

export const ENVIRONMENTS = {
  norrland: 'Norrländsk småort',
  stockholm: 'Stockholm stad',
  hotel: 'Hotell under vinterstorm',
  forest_house: 'Avlägset hus i skogen',
  workplace: 'Arbetsplats med interna konflikter',
  archipelago: 'Skärgårdsö',
  old_municipality: 'Äldre fall i svensk kommun',
};

export const SOURCE_STATUS = {
  fact: { id: 'fact', label: 'Bekräftat faktum', color: '#3fbf6f' },
  testimony: { id: 'testimony', label: 'Uppgift från person', color: '#6aa9ff' },
  circumstantial: { id: 'circumstantial', label: 'Indirekt indicium', color: '#f5a623' },
  uncertain: { id: 'uncertain', label: 'Osäker uppgift', color: '#b07bd8' },
  theory: { id: 'theory', label: 'Spelarens teori', color: '#e6ebf1' },
};

export const EVIDENCE_CATEGORIES = {
  photo: 'Fotografi',
  document: 'Dokument',
  testimony: 'Vittnesmål',
  technical: 'Teknisk rapport',
  physical: 'Föremål och spår',
  digital: 'Digital information',
  transcript: 'Förhörsprotokoll',
};

export const CASE_STATUSES = {
  draft: 'Utkast',
  in_review: 'Under granskning',
  approved: 'Godkänt',
  unpublished: 'Avpublicerat',
  reredview: 'Under ny granskning',
};

export const ROOM_MODES = {
  solo: 'Enspelarläge',
  cooperative: 'Samarbete',
  competitive: 'Tävling',
};

export const SCORE_SYSTEMS = {
  realistic: 'Realistiskt läge (inga poäng)',
  competitive: 'Tävlingsläge (poäng)',
};

export const CONNECTION_TYPES = {
  supported: { id: 'supported', label: 'Underbyggt samband', color: '#3fbf6f' },
  plausible: { id: 'plausible', label: 'Möjligt men obekräftat', color: '#f5a623' },
  contradiction: { id: 'contradiction', label: 'Motsägelse', color: '#e01b3c' },
  unsupported: { id: 'unsupported', label: 'Saknar stöd', color: '#8b97a5' },
};

export const ROLES = {
  user: 'user',
  moderator: 'moderator',
  admin: 'admin',
};

export const VALIDATION_SEVERITY = { error: 'Kritiskt fel', warning: 'Varning', info: 'Förbättringsförslag' };
