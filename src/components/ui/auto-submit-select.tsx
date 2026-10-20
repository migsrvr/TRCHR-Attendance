"use client";

/** A filter <select> inside a GET form that applies as soon as it changes. */
export function AutoSubmitSelect({
  id,
  name,
  value,
  options,
}: {
  id: string;
  name: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      id={id}
      name={name}
      defaultValue={value}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
      className="h-9 rounded-btn border border-border bg-card px-3 text-[13px] text-foreground"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
