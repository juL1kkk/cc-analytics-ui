export type DepartmentDictionaryItemV2 = {
  id?: string | number;
  code?: string;
  nameRu?: string;
  name?: string;
  label?: string;
  value?: string;
};

export type DepartmentsDictionaryResponseV2 = {
  items?: DepartmentDictionaryItemV2[];
};

export async function fetchDepartmentsV2(): Promise<DepartmentsDictionaryResponseV2> {
  const res = await fetch("/api/dictionaries/departments/v2", {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`departments/v2 failed: ${res.status}`);
  return res.json();
}
