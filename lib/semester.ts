/** 學期代碼：民國學年 + 學期（1=上、2=下），例 1151 = 115 學年度第 1 學期 */

export type SemesterOption = {
  code: string;
  label: string;
  filePrefix: string;
};

/** 當前開放填報／後台預設學期；換學期只改這裡 */
export const CURRENT_SEMESTER = "1151";

export const SEMESTERS: SemesterOption[] = [
  {
    code: "1151",
    label: "115 學年度第 1 學期",
    filePrefix: "115-1",
  },
  {
    code: "1142",
    label: "114 學年度第 2 學期",
    filePrefix: "114-2",
  },
];

export function getSemesterMeta(code: string): SemesterOption {
  return (
    SEMESTERS.find((s) => s.code === code) ?? {
      code,
      label: code,
      filePrefix: code,
    }
  );
}

export const CURRENT_SEMESTER_META = getSemesterMeta(CURRENT_SEMESTER);
