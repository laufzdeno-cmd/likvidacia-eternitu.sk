import { leadSchema } from '../src/server/validation';

const messages = {
  areaEstimate: 'Zadajte výmeru od 1 do 100 000 m².',
  city: 'Zadajte obec alebo mesto (aspoň 2 znaky).',
  district: 'Okres môže mať najviac 120 znakov.',
  materialType: 'Vyberte typ materiálu.',
  objectType: 'Vyberte typ objektu.',
  roofer: 'Vyberte jednu z možností.',
  term: 'Vyberte jednu z možností.',
  fullName: 'Zadajte meno a priezvisko (2 až 120 znakov).',
  phone: 'Zadajte platné telefónne číslo, napr. 0905 123 456.',
  email: 'Zadajte platnú emailovú adresu.',
  note: 'Poznámka môže mať najviac 3 000 znakov.',
  gdpr: 'Potvrďte súhlas so spracovaním údajov.',
};
type FieldName = keyof typeof messages;

export function fieldError(name: string, value: string): string | null {
  if (!Object.hasOwn(messages, name)) return null;
  const field = name as FieldName;
  if (field === 'phone' && (!/^\+?[\d\s().-]+$/.test(value.trim()) || value.replace(/\D/g, '').length < 7)) return messages.phone;
  return leadSchema.shape[field].safeParse(value).success ? null : messages[field];
}

export function attachLeadFieldFeedback(form: HTMLFormElement) {
  const controls = Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea'))
    .filter((field) => Object.hasOwn(messages, field.name));
  const touched = new Set<Element>();
  const errors = new Map<Element, HTMLElement>();
  const originalDescriptions = new Map<Element, string | null>();
  controls.forEach((field) => {
    const error = document.createElement('span');
    error.id = `lead-error-${field.name}`;
    error.className = 'field-validation-message';
    error.hidden = true;
    (field.closest('.field, .consent') || field.parentElement)?.append(error);
    originalDescriptions.set(field, field.getAttribute('aria-describedby'));
    errors.set(field, error);
  });
  const paint = (field: typeof controls[number], reveal: boolean) => {
    const value = field instanceof HTMLInputElement && field.type === 'checkbox'
      ? (field.checked ? 'on' : '') : field.value;
    const error = fieldError(field.name, value);
    const invalid = Boolean(error && reveal);
    const valid = !error && value.trim() !== '';
    field.dataset.fieldState = invalid ? 'invalid' : valid ? 'valid' : 'neutral';
    field.setAttribute('aria-invalid', String(invalid));
    const message = errors.get(field)!;
    message.textContent = invalid ? error : '';
    message.hidden = !invalid;
    const description = originalDescriptions.get(field);
    if (invalid) field.setAttribute('aria-describedby', [description, message.id].filter(Boolean).join(' '));
    else if (description) field.setAttribute('aria-describedby', description);
    else field.removeAttribute('aria-describedby');
    return !error;
  };
  const onEdit = (event: Event) => {
    const field = controls.find((item) => item === event.target);
    if (field) paint(field, touched.has(field));
  };
  const onBlur = (event: Event) => {
    const field = controls.find((item) => item === event.target);
    if (field) { touched.add(field); paint(field, true); }
  };
  form.addEventListener('input', onEdit);
  form.addEventListener('change', onEdit);
  form.addEventListener('focusout', onBlur);
  return {
    validate() {
      let first: typeof controls[number] | undefined;
      controls.forEach((field) => { touched.add(field); if (!paint(field, true) && !first) first = field; });
      first?.focus();
      return !first;
    },
    reset() {
      touched.clear();
      controls.forEach((field) => { paint(field, false); field.dataset.fieldState = 'neutral'; });
    },
    destroy() {
      form.removeEventListener('input', onEdit);
      form.removeEventListener('change', onEdit);
      form.removeEventListener('focusout', onBlur);
      controls.forEach((field) => {
        errors.get(field)?.remove();
        delete field.dataset.fieldState;
        field.removeAttribute('aria-invalid');
        const description = originalDescriptions.get(field);
        if (description) field.setAttribute('aria-describedby', description);
        else field.removeAttribute('aria-describedby');
      });
    },
  };
}
