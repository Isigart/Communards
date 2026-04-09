import { createServerClient } from '@/lib/supabase';
import { BriefDisplay } from './BriefDisplay';

interface Props {
  params: { code: string };
}

export default async function BriefPage({ params }: Props) {
  const supabase = createServerClient();

  const { data: brief } = await supabase
    .from('brief_codes')
    .select('*, supply_spans(*)')
    .eq('code', params.code)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (!brief) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-xl font-bold text-red-600">Code invalide ou expire</h1>
          <p className="text-gray-500 mt-2">Demandez un nouveau code au chef.</p>
        </div>
      </div>
    );
  }

  const { data: suggestions } = await supabase
    .from('suggestions')
    .select('*')
    .eq('span_id', brief.span_id)
    .order('meal_date', { ascending: true })
    .order('meal_type', { ascending: true });

  const { data: establishment } = await supabase
    .from('establishments')
    .select('name')
    .eq('id', brief.establishment_id)
    .single();

  return (
    <BriefDisplay
      establishmentName={establishment?.name || ''}
      suggestions={suggestions || []}
      span={brief.supply_spans}
    />
  );
}
