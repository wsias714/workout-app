/* Shapes that sync reads and writes. The app itself is plain JS; these mirror what
   App.jsx keeps in `gym:workouts`, `gym:meta` and `gym:activity`. */

export interface GymSet {
  weight: number;
  reps: number;
  done?: boolean;
}
export interface GymExercise {
  name: string;
  sets: GymSet[];
  /** Set count before roll-up (compact workouts keep only the best set). */
  n?: number;
}
export interface Workout {
  id: string;
  name: string;
  date: string; // ISO
  gym?: string;
  exercises: GymExercise[];
  /** True once rolled up to each exercise's best set; the full sets live in archive/<year>.json. */
  compact?: boolean;
}
export interface Routine {
  id: string;
  gym?: string;
  name: string;
  exercises: unknown[];
  coach?: boolean;
  /** ms epoch of the last edit; later wins on merge. Missing means "old", treated as 0. */
  updated?: number;
}
export interface Activity {
  id: string;
  date: string;
  type: string;
  duration?: number;
  calories?: number;
  /** Monthly roll-up entries: how many sessions they stand for. */
  count?: number;
}
export interface Meta {
  gyms: { id: string; name: string }[];
  /** Per device. Never taken from the other side on merge. */
  activeGym: string;
  routines: Routine[];
  customExercises: { name: string; group?: string; type?: string }[];
  settings: Record<string, unknown>;
  /** ms epoch of the last settings edit; the whole settings object, later wins. */
  settingsAt?: number;
  /** Deletes, as id -> ms epoch. Expire after TOMBSTONE_DAYS. */
  tomb?: { workouts: Record<string, number>; routines: Record<string, number> };
}
export interface GymData {
  workouts: Workout[];
  meta: Meta;
  activity: Activity[];
}
