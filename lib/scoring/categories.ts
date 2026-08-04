import type { CategoryId } from '@/lib/report/types';

export type Category = {
  id: CategoryId;
  label: string;
  /** Weight when computing Walk Score. Sums to 15 across all categories. */
  weight: number;
  /** Weight when computing Drive Score — car-relevant needs rank differently. */
  driveWeight: number;
  /** Overpass tag filters, applied as a union. */
  tags: string[];
};

export const CATEGORIES: readonly Category[] = [
  {
    id: 'grocery', label: 'Grocery', weight: 3, driveWeight: 3,
    tags: ['shop=supermarket', 'shop=grocery', 'shop=convenience'],
  },
  {
    id: 'dining', label: 'Dining', weight: 2, driveWeight: 1.5,
    tags: ['amenity=restaurant', 'amenity=fast_food'],
  },
  {
    id: 'cafe', label: 'Cafe', weight: 1.5, driveWeight: 0.5,
    tags: ['amenity=cafe'],
  },
  {
    id: 'retail', label: 'Retail', weight: 2, driveWeight: 3,
    tags: ['shop=clothes', 'shop=department_store', 'shop=mall', 'shop=books', 'shop=hardware'],
  },
  {
    id: 'errands', label: 'Errands', weight: 2, driveWeight: 2.5,
    tags: ['amenity=pharmacy', 'amenity=bank', 'amenity=post_office', 'shop=hairdresser', 'shop=laundry'],
  },
  {
    id: 'parks', label: 'Parks', weight: 1.5, driveWeight: 1,
    tags: ['leisure=park', 'leisure=garden', 'leisure=playground', 'landuse=recreation_ground'],
  },
  {
    id: 'schools', label: 'Schools', weight: 1, driveWeight: 1,
    tags: ['amenity=school', 'amenity=kindergarten', 'amenity=college', 'amenity=university'],
  },
  {
    id: 'culture', label: 'Culture', weight: 1, driveWeight: 1,
    tags: ['amenity=library', 'amenity=theatre', 'amenity=cinema', 'amenity=arts_centre', 'tourism=museum'],
  },
  {
    id: 'fitness', label: 'Fitness', weight: 1, driveWeight: 1.5,
    tags: ['leisure=fitness_centre', 'leisure=sports_centre', 'leisure=pitch'],
  },
] as const;

export function categoryById(id: CategoryId): Category {
  const found = CATEGORIES.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown category: ${id}`);
  return found;
}
