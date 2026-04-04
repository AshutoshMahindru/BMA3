import { notFound } from 'next/navigation';
import AssumptionFamilySurface from '@/components/assumptions/family-surface';
import { isAssumptionFamilyKey } from '@/lib/assumptions-surfaces';

export default function AssumptionFamilyPage({ params }: { params: { family: string } }) {
  if (!isAssumptionFamilyKey(params.family)) {
    notFound();
  }

  return <AssumptionFamilySurface family={params.family} />;
}
