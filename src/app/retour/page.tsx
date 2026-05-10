import { Suspense } from 'react';
import RetourContent from './RetourContent';

export const metadata = {
  title: 'Heureuse de te retrouver — NOVAÉ',
  description: 'Reviens chez toi, dans ta communauté NOVAÉ.',
};

export default function RetourPage() {
  return (
    <Suspense fallback={null}>
      <RetourContent />
    </Suspense>
  );
}