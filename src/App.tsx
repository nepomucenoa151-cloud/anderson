/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import {
  Check,
  X,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Award,
  Lock,
  ArrowRight,
  Leaf,
  Clock,
  Sparkles,
  AlertCircle,
  HelpCircle,
  QrCode,
  CreditCard,
  CheckCircle2,
  FileText
} from 'lucide-react';

interface Symptom {
  id: string;
  name: string;
  desc: string;
  icon: string;
}

const SYMPTOMS_LIST: Symptom[] = [
  { id: 'insonia', name: 'Insônia', desc: 'Dificuldade para adormecer e sono agitado', icon: '🌙' },
  { id: 'fadiga', name: 'Fadiga', desc: 'Cansaço persistente mesmo após descansar', icon: '⚡' },
  { id: 'sede', name: 'Sede Excessiva', desc: 'Sensação de boca seca e micção frequente', icon: '💧' },
  { id: 'formigamento', name: 'Formigamento', desc: 'Sensação de agulhadas nas mãos ou pés', icon: '✋' },
  { id: 'visao', name: 'Visão Embaçada', desc: 'Perda temporária de foco ao ler ou olhar longe', icon: '👁️' },
  { id: 'dores', name: 'Dores no Corpo', desc: 'Desconforto muscular e peso nas pernas', icon: '🩺' },
];

const TIME_OPTIONS = [
  { id: 'mais_1_ano', label: 'Sim, sinto há mais de 1 ano', subtitle: 'Quadro crônico' },
  { id: 'menos_1_ano', label: 'Sinto há menos de 1 ano', subtitle: 'Fase inicial' },
  { id: 'dois_ou_mais', label: 'Sinto 2 ou mais sintomas frequentes', subtitle: 'Alta intensidade' },
];

const FAQ_ITEMS = [
  {
    q: 'O protocolo é compatível para quem toma Metformina ou aplica Insulina?',
    a: 'Sim, perfeitamente. O protocolo não substitui abruptamente seus remédios receitados, mas atua na causa-raiz biológica da sobrecarga parasitária. Conforme a sensibilidade à insulina se normaliza naturalmente, seu médico poderá reavaliar as doses dos remédios.'
  },
  {
    q: 'Vou sentir desconforto estomacal ou diarréia durante a desparasitação?',
    a: 'De maneira alguma. Os bioativos naturais combinados dissolvem o biofilme e as membranas dos parasitas internamente. Eles são expelidos já desmanchados e mortos durante o trânsito intestinal normal diário, sem dores, cólicas ou qualquer incômodo perceptível.'
  },
  {
    q: 'Os ingredientes da vitamina de abacate são caros ou difíceis de encontrar?',
    a: 'Não. Todos os ingredientes são 100% naturais, acessíveis e encontrados em qualquer supermercado, feira livre ou mercearia por um valor muito baixo (menos de R$ 15 no total).'
  },
  {
    q: 'Como e quando recebo o acesso ao protocolo?',
    a: 'O envio é imediato. Assim que o pagamento de R$ 37,90 é confirmado pelo sistema, o link do protocolo completo, guias em PDF e instruções da vitamina de abacate chegam diretamente no seu e-mail e WhatsApp.'
  },
  {
    q: 'Como funciona a Garantia Incondicional de 30 dias?',
    a: 'Você tem 30 dias completos assegurados pelo Artigo 49 do Código de Defesa do Consumidor (Risco Zero). Se você aplicar as instruções simples da vitamina e não notar uma redução expressiva na sua glicose, basta enviar uma mensagem e devolveremos 100% do seu dinheiro.'
  }
];

const PURCHASES_LIST = [
  { name: 'Marcos Vinícius', city: 'Belo Horizonte', uf: 'MG', time: 'há 1 minuto' },
  { name: 'Cleuza Helena', city: 'Curitiba', uf: 'PR', time: 'há 2 minutos' },
  { name: 'Antônio Carlos', city: 'Campinas', uf: 'SP', time: 'há 3 minutos' },
  { name: 'Rosângela Moreira', city: 'Salvador', uf: 'BA', time: 'há 1 minuto' },
  { name: 'Geraldo Magela', city: 'Goiânia', uf: 'GO', time: 'há 4 minutos' },
  { name: 'Sandra Regina', city: 'Porto Alegre', uf: 'RS', time: 'há 2 minutos' },
  { name: 'José Roberto', city: 'Fortaleza', uf: 'CE', time: 'há 1 minuto' },
  { name: 'Vera Lúcia Pires', city: 'Ribeirão Preto', uf: 'SP', time: 'há 3 minutos' },
  { name: 'Benedito Souza', city: 'Cuiabá', uf: 'MT', time: 'há 5 minutos' },
  { name: 'Maria de Fátima', city: 'Joinville', uf: 'SC', time: 'há 2 minutos' },
];

/* 1. CABEÇALHO ISOLADO E MEMOIZADO */
const Header = memo(function Header() {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#38A169]/10 text-[#38A169] flex items-center justify-center font-bold" aria-hidden="true">
            <Leaf className="w-5 h-5 text-[#38A169]" />
          </div>
          <div>
            <span className="font-heading font-black text-sm tracking-tight text-[#38A169] uppercase block leading-tight">
              PROTOCOLO GLICOSE ZERO
            </span>
            <span className="text-[10px] text-slate-500 font-medium block">
              Saúde Metabólica & Desparasitação Natural
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
          <ShieldCheck className="w-4 h-4 text-[#38A169]" />
          <span>Método 100% Natural</span>
        </div>
      </div>
    </header>
  );
});

/* 2. BARRA DE PROGRESSO */
const ProgressTracker = memo(function ProgressTracker({ hasAnalyzed }: { hasAnalyzed: boolean }) {
  return (
    <div className="bg-slate-50 border-b border-slate-200 py-2">
      <div className="max-w-3xl mx-auto px-4 flex items-center justify-between text-xs text-slate-600 font-medium">
        <span className="flex items-center gap-1.5 text-[#38A169] font-bold">
          <span className="w-2 h-2 rounded-full bg-[#38A169] animate-pulse"></span>
          Passo 1 de 2: Avaliação Clínica
        </span>
        <span className="text-slate-500">Tempo estimado: 30 segundos</span>
      </div>
      <div className="max-w-3xl mx-auto px-4 mt-1.5">
        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-[#38A169] h-full transition-all duration-500 ease-out"
            style={{ width: hasAnalyzed ? '100%' : '50%' }}
          />
        </div>
      </div>
    </div>
  );
});

/* 3. HERO & VÍDEO PRINCIPAL */
const HeroSection = memo(function HeroSection() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const postCmd = (func: string, args: (string | number)[] = []) => {
      try {
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func, args }),
            '*'
          );
        }
      } catch {
        // Safe cross-origin handling
      }
    };

    const setHighVolume = () => {
      postCmd('unMute');
      postCmd('setVolume', [100]);
    };

    // Define volume alto logo no carregamento e após o player estar pronto
    const t1 = setTimeout(setHighVolume, 600);
    const t2 = setTimeout(setHighVolume, 1600);

    // Garante volume 100% no primeiro gesto caso o navegador restrinja áudio de autoplay
    const onUserGesture = () => {
      setHighVolume();
    };

    window.addEventListener('click', onUserGesture, { once: true });
    window.addEventListener('touchstart', onUserGesture, { once: true });
    window.addEventListener('scroll', onUserGesture, { once: true });

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('click', onUserGesture);
      window.removeEventListener('touchstart', onUserGesture);
      window.removeEventListener('scroll', onUserGesture);
    };
  }, []);

  return (
    <section aria-label="Alerta e Chamada Principal" className="text-center pt-2 sm:pt-4 pb-1 space-y-3 sm:space-y-4 border-b border-slate-100">
      <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-slate-950 uppercase tracking-tight leading-snug sm:leading-tight max-w-2xl sm:max-w-3xl mx-auto">
        <span className="inline-block bg-black text-white px-2.5 py-1 rounded font-black mr-2 text-sm sm:text-xl md:text-2xl align-middle shadow-sm">
          URGENTE:
        </span>
        <span className="text-[#38A169]">TRUQUE CASEIRO DE 14 DIAS</span>{' '}
        <span className="text-slate-950">ESTÁ ELIMINANDO</span>{' '}
        <span className="text-[#38A169]">PARASITA DIABETICO</span>{' '}
        <span className="text-slate-950">E ACABANDO COM A</span>{' '}
        <span className="text-[#38A169]">DIABETES TIPO 2.</span>
      </h1>

      {/* VÍDEO PRINCIPAL DO DOUTOR COM AUTOPLAY E VOLUME ALTO */}
      <div className="w-full max-w-2xl mx-auto pt-2 px-1">
        <div className="relative w-full aspect-video rounded-2xl overflow-hidden border-2 border-slate-200 shadow-xl bg-black">
          <iframe
            ref={iframeRef}
            className="w-full h-full object-cover"
            src="https://www.youtube-nocookie.com/embed/CVsMl-Hv4oU?autoplay=1&mute=0&playsinline=1&controls=1&rel=0&modestbranding=1&enablejsapi=1"
            title="Vídeo Explicativo - Protocolo de Desparasitação"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>

      {/* TEXTO EM DESTAQUE ABAIXO DO VÍDEO DO DOUTOR */}
      <div className="pt-3 pb-1 px-1 max-w-2xl mx-auto">
        <div className="bg-[#F0FDF4] border-2 border-[#38A169] rounded-2xl p-4 sm:p-5 shadow-sm text-center">
          <p className="text-sm sm:text-lg md:text-xl font-black text-slate-900 uppercase tracking-tight leading-snug sm:leading-relaxed">
            RESPONDA ESSE RÁPIDO TESTE GRATUITO E APRENDA COMO{' '}
            <span className="text-[#38A169] underline decoration-[#38A169] decoration-2 underline-offset-4">
              ELIMINAR ESSE PARASITA DO SEU CORPO
            </span>{' '}
            E FICAR LIVRE DA DIABETES.
          </p>
        </div>
      </div>
    </section>
  );
});

/* 4. QUIZ ISOLADO: SELEÇÃO RÁPIDA SEM RE-RENDERIZAR A PÁGINA INTEIRA */
interface QuizSectionProps {
  onAnalyze: () => void;
  isAnalyzing: boolean;
}

const QuizSection = memo(function QuizSection({ onAnalyze, isAnalyzing }: QuizSectionProps) {
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>(['fadiga', 'sede', 'formigamento']);
  const [selectedTime, setSelectedTime] = useState<string>('mais_1_ano');

  const toggleSymptom = useCallback((id: string) => {
    setSelectedSymptoms(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  }, []);

  const handleGenerate = () => {
    if (selectedSymptoms.length === 0) {
      alert('Por favor, selecione ao menos um sintoma para gerar a análise precisa.');
      return;
    }
    onAnalyze();
  };

  return (
    <section aria-label="Avaliação de Sintomas" className="space-y-6 pt-1">
      {/* IMAGEM ILUSTRATIVA ACIMA DA SELEÇÃO DO QUESTIONÁRIO (COM DIMENSÕES EXPLÍCITAS E LAZY LOADING) */}
      <div className="w-full max-w-lg mx-auto rounded-2xl overflow-hidden border border-slate-200 shadow-md bg-white">
        <img
          src="https://i.ibb.co/B2tv0xc6/Gemini-Generated-Image-s939kas939kas939.jpg"
          alt="Protocolo de Desparasitação Natural para Diabetes"
          width="512"
          height="340"
          className="w-full h-auto object-cover block"
          loading="lazy"
          decoding="async"
        />
      </div>

      {/* SINTOMAS - CARTÕES BRANCOS COM BORDA FINA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {SYMPTOMS_LIST.map(item => {
          const isSelected = selectedSymptoms.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggleSymptom(item.id)}
              className={`p-4 rounded-xl border text-left transition-all duration-200 flex items-start gap-3.5 cursor-pointer ${
                isSelected
                  ? 'bg-[#F0FDF4] border-[#38A169] ring-1 ring-[#38A169] shadow-sm'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-[#F7FAFC] shadow-sm'
              }`}
            >
              <div
                className={`w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 border transition-colors ${
                  isSelected
                    ? 'bg-[#38A169] border-[#38A169] text-white'
                    : 'border-slate-300 bg-white'
                }`}
              >
                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-base">{item.icon}</span>
                  <span className={`text-sm font-bold ${isSelected ? 'text-[#276749]' : 'text-slate-900'}`}>
                    {item.name}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* PERGUNTA DE TEMPO */}
      <div className="bg-[#F7FAFC] border border-slate-200 rounded-2xl p-5 space-y-3">
        <h2 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#38A169]" />
          Você sente algum desses sintomas há mais de 1 ano?
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {TIME_OPTIONS.map(opt => {
            const isSelected = selectedTime === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedTime(opt.id)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-white border-[#38A169] ring-2 ring-[#38A169]/30 text-slate-900 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className="text-xs font-bold block">{opt.label}</span>
                <span className={`text-[10px] mt-0.5 block font-semibold ${isSelected ? 'text-[#38A169]' : 'text-slate-400'}`}>
                  {opt.subtitle}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* BOTÃO CTA PRINCIPAL VERDE ARREDONDADO */}
      <div className="text-center pt-2">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isAnalyzing}
          className="w-full sm:w-auto sm:min-w-[320px] px-8 py-4 rounded-full bg-[#38A169] hover:bg-[#2F855A] active:bg-[#276749] text-white font-extrabold text-base sm:text-lg shadow-md shadow-[#38A169]/30 hover:shadow-lg transition-all transform active:scale-98 cursor-pointer flex items-center justify-center gap-2.5 mx-auto"
        >
          {isAnalyzing ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Processando Indicadores...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>Gerar Protocolo de Tratamento!</span>
            </>
          )}
        </button>
        <p className="text-xs text-slate-500 mt-2.5 flex items-center justify-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-[#38A169]" />
          <span>Avaliação individual com proteção de dados</span>
        </p>
      </div>
    </section>
  );
});

/* 5. ANÁLISE DE SINTOMAS & DIAGNÓSTICO */
interface AnalysisSectionProps {
  onScrollToOffer: () => void;
}

const AnalysisSection = memo(function AnalysisSection({ onScrollToOffer }: AnalysisSectionProps) {
  return (
    <section
      aria-label="Diagnóstico e Análise de Riscos"
      className="bg-white border-2 border-[#38A169]/40 rounded-3xl p-5 sm:p-8 shadow-sm space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
        <div>
          <span className="text-[11px] font-bold text-[#38A169] uppercase tracking-wider">
            Resultado da Análise Sintomática
          </span>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
            Diagnóstico de Sobrecarga Parasitária
          </h3>
        </div>
        <span className="self-start sm:self-center bg-slate-100 text-slate-700 text-xs px-3 py-1 rounded-full font-bold border border-slate-200">
          Laudo Metabólico
        </span>
      </div>

      {/* GRÁFICOS DE BARRAS HORIZONTAIS */}
      <div className="bg-[#F7FAFC] border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-5">
        {/* 1. Chances de possuir parasitas: 95% (vermelho) */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs sm:text-sm font-bold text-slate-800">
            <span className="flex items-center gap-1.5 text-rose-700">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
              Chances de possuir parasitas no organismo:
            </span>
            <span className="font-mono text-rose-700 font-extrabold text-sm sm:text-base">95%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3.5 overflow-hidden">
            <div
              className="bg-rose-500 h-full rounded-full transition-all duration-1000 ease-out"
              style={{ width: '95%' }}
            />
          </div>
        </div>

        {/* 2. Risco de complicação: 86% (alaranjado/amarelo) */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs sm:text-sm font-bold text-slate-800">
            <span className="flex items-center gap-1.5 text-amber-700">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              Risco de complicação:
            </span>
            <span className="font-mono text-amber-700 font-extrabold text-sm sm:text-base">86%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3.5 overflow-hidden">
            <div
              className="bg-amber-500 h-full rounded-full transition-all duration-1000 ease-out"
              style={{ width: '86%' }}
            />
          </div>
        </div>

        {/* 3. Chances de contrair doenças autoimunes: 77% (amarelo) */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs sm:text-sm font-bold text-slate-800">
            <span className="flex items-center gap-1.5 text-yellow-800">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
              Chances de contrair doenças autoimunes:
            </span>
            <span className="font-mono text-yellow-800 font-extrabold text-sm sm:text-base">77%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3.5 overflow-hidden">
            <div
              className="bg-yellow-500 h-full rounded-full transition-all duration-1000 ease-out"
              style={{ width: '77%' }}
            />
          </div>
        </div>

        {/* 4. Chances de eliminar a Diabetes com o protocolo: 100% (verde) */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between items-center text-xs sm:text-sm font-bold text-slate-800">
            <span className="flex items-center gap-1.5 text-[#276749]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#38A169]"></span>
              Chances de eliminar a Diabetes com o protocolo:
            </span>
            <span className="font-mono text-[#276749] font-extrabold text-sm sm:text-base">100%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3.5 overflow-hidden">
            <div
              className="bg-[#38A169] h-full rounded-full transition-all duration-1000 ease-out shadow-sm"
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </div>

      {/* BLOCO INFORMATIVO: AGENTE PARASITÁRIO */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2.5">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-md bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200">
            Agente Identificado
          </span>
          <span className="text-xs font-semibold text-slate-500">Correlação sintomática direta</span>
        </div>
        <h4 className="text-lg font-bold text-slate-900">
          Possível agente parasitário de acordo com os sintomas: <span className="text-rose-600 italic">Ascaris lumbricoides</span>
        </h4>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          Esses parasitas alojam-se silenciosamente no duodeno e ductos biliares pancreáticos. Eles formam um biofilme que bloqueia os receptores celulares de insulina, provocando inflamação contínua e impedindo que a glicose entre nas células para virar energia.
        </p>
      </div>

      {/* CAIXA AMARELA/SUAVE DE AVISO TRANQUILIZADOR */}
      <div className="rounded-2xl bg-amber-50/80 border border-amber-200 p-4 sm:p-5 flex items-start gap-3.5 text-amber-900">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-amber-900">
            Aviso Importante de Conforto:
          </h4>
          <p className="text-xs sm:text-sm font-medium text-amber-800 leading-relaxed">
            "Nenhum verme ou parasita sairá vivo de forma incomoda. Eles são eliminados já mortos e desmanchados, quase imperceptíveis."
          </p>
          <p className="text-xs text-amber-700/90 leading-relaxed">
            O método não causa desarranjos, nem cólicas intestinais. A eliminação ocorre de forma suave e indolor através do trânsito digestivo normal.
          </p>
        </div>
      </div>

      {/* EXPLICAÇÃO DO MÉTODO: VITAMINA DE ABACATE */}
      <div className="rounded-2xl bg-[#F0FDF4] border border-[#48BB78]/40 p-5 sm:p-6 space-y-3 text-center sm:text-left">
        <span className="inline-block px-2.5 py-0.5 rounded-md bg-white text-[#2F855A] text-xs font-bold border border-[#48BB78]/30">
          Fundamento do Tratamento
        </span>
        <h4 className="text-base sm:text-lg font-bold text-[#22543D]">
          Como Ocorre a Desparasitação Natural
        </h4>
        <p className="text-sm text-slate-700 leading-relaxed">
          "A Desparasitação ocorrerá primeiramente através de uma <strong className="text-[#276749]">vitamina de abacate com um ingrediente secreto</strong> facilmente encontrado nos mercados."
        </p>
        <p className="text-xs text-slate-600 leading-relaxed">
          Os ácidos graxos nobres do abacate servem como veículo para os fitoativos naturais, que dissolvem a cápsula protetora dos vermes e devolvem o equilíbrio ao pâncreas em 14 dias.
        </p>

        <div className="pt-2 text-center sm:text-left">
          <button
            type="button"
            onClick={onScrollToOffer}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-white bg-[#38A169] hover:bg-[#2F855A] px-5 py-2.5 rounded-full transition-colors cursor-pointer"
          >
            <span>Ver Detalhes do Protocolo Completo</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
});

/* 6. TABELA COMPARATIVA CLEAN */
const ComparisonSection = memo(function ComparisonSection() {
  return (
    <section aria-label="Tabela Comparativa de Tratamentos" className="space-y-6">
      <div className="text-center space-y-1">
        <span className="text-xs font-bold text-[#38A169] uppercase tracking-wider">
          Comparativo Direto
        </span>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
          Remédios Tradicionais vs. Nosso Protocolo
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto">
          Veja a diferença entre tratar apenas os números ou curar a verdadeira causa.
        </p>
      </div>

      {/* IMAGEM ILUSTRATIVA DO COMPARATIVO COM WIDTH/HEIGHT E LAZY */}
      <div className="w-full max-w-lg mx-auto rounded-2xl overflow-hidden border border-slate-200 shadow-md bg-white">
        <img
          src="https://i.ibb.co/jZ1fpWb2/Gemini-Generated-Image-e77jsle77jsle77j.jpg"
          alt="Comparativo Remédios Tradicionais vs Nosso Protocolo"
          width="512"
          height="340"
          className="w-full h-auto object-cover block"
          loading="lazy"
          decoding="async"
        />
      </div>

      {/* DESCRIÇÕES COMPARATIVAS ABAIXO DA IMAGEM */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* REMÉDIOS TRADICIONAIS */}
        <div className="bg-[#F7FAFC] border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h3 className="font-bold text-slate-800 text-base">
              Remédios Tradicionais
            </h3>
            <div className="w-7 h-7 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
              <X className="w-4 h-4 stroke-[3]" />
            </div>
          </div>

          <ul className="space-y-3 text-xs sm:text-sm text-slate-600">
            <li className="flex items-start gap-2.5">
              <X className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span><strong>Não acabam de vez:</strong> Dependência perpétua de pílulas ou picadas diárias.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <X className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span><strong>Destroem o intestino:</strong> Agravam a inflamação, refluxo e a microbiota.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <X className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span><strong>Mascaram sintomas:</strong> O parasita continua ativo no pâncreas e vasos sanguíneos.</span>
            </li>
          </ul>
        </div>

        {/* NOSSO PROTOCOLO */}
        <div className="bg-white border-2 border-[#38A169] rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm relative">
          <span className="absolute -top-3 right-4 bg-[#38A169] text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
            Recomendado
          </span>

          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-bold text-[#276749] text-base">
              Nosso Protocolo Natural
            </h3>
            <div className="w-7 h-7 rounded-full bg-[#EBF8F2] text-[#38A169] flex items-center justify-center font-bold">
              <Check className="w-4 h-4 stroke-[3]" />
            </div>
          </div>

          <ul className="space-y-3 text-xs sm:text-sm text-slate-700">
            <li className="flex items-start gap-2.5">
              <Check className="w-4 h-4 text-[#38A169] shrink-0 mt-0.5 stroke-[2.5]" />
              <span><strong>Acaba com a diabetes em 14 dias:</strong> Glicose estabilizada no valor de referência seguro.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <Check className="w-4 h-4 text-[#38A169] shrink-0 mt-0.5 stroke-[2.5]" />
              <span><strong>100% natural:</strong> Sem efeitos colaterais adversos, preparado na sua própria cozinha.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <Check className="w-4 h-4 text-[#38A169] shrink-0 mt-0.5 stroke-[2.5]" />
              <span><strong>Elimina mais de 150 parasitas:</strong> Purifica o duodeno e restaura a produção de insulina.</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
});

/* 7. DEPOIMENTOS EM CELULARES (IFRAMES COM LAZY LOADING PARA NÃO PESAR O INÍCIO) */
const TestimonialsSection = memo(function TestimonialsSection() {
  return (
    <section aria-label="Depoimentos de Pacientes" className="space-y-6 pt-2">
      <div className="text-center space-y-1">
        <span className="text-xs font-bold text-[#38A169] uppercase tracking-wider bg-[#38A169]/10 px-3 py-1 rounded-full inline-block">
          Histórias Reais de Superação
        </span>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
          Depoimentos de Quem Já Testou o Protocolo
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto">
          Assista abaixo ao relato em vídeo de quem aplicou o método da desparasitação natural e transformou a sua saúde.
        </p>
      </div>

      {/* MOCKUPS FORMATO CELULAR LADO A LADO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl sm:max-w-3xl mx-auto px-2 justify-center items-start">
        {/* VÍDEO 1 */}
        <div className="relative mx-auto w-full max-w-[290px] sm:max-w-[310px] bg-slate-950 p-2.5 rounded-[2.5rem] shadow-xl border-[4px] border-slate-800 ring-4 ring-slate-100">
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-4 bg-slate-950 rounded-full z-20 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-800 mr-2" />
            <div className="w-8 h-1 bg-slate-800 rounded-full" />
          </div>

          <div className="relative w-full aspect-[9/16] rounded-[2rem] overflow-hidden bg-black shadow-inner">
            <iframe
              className="w-full h-full object-cover"
              src="https://www.youtube-nocookie.com/embed/gZK0AybZlRU?rel=0&modestbranding=1"
              title="Depoimento 1 sobre o Protocolo de Desparasitação"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          </div>

          <div className="pt-2 pb-1 flex justify-center">
            <div className="w-24 h-1 bg-slate-600 rounded-full" />
          </div>
        </div>

        {/* VÍDEO 2 */}
        <div className="relative mx-auto w-full max-w-[290px] sm:max-w-[310px] bg-slate-950 p-2.5 rounded-[2.5rem] shadow-xl border-[4px] border-slate-800 ring-4 ring-slate-100">
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-4 bg-slate-950 rounded-full z-20 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-800 mr-2" />
            <div className="w-8 h-1 bg-slate-800 rounded-full" />
          </div>

          <div className="relative w-full aspect-[9/16] rounded-[2rem] overflow-hidden bg-black shadow-inner">
            <iframe
              className="w-full h-full object-cover"
              src="https://www.youtube-nocookie.com/embed/viVvubfdhOY?rel=0&modestbranding=1"
              title="Depoimento 2 sobre o Protocolo de Desparasitação"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          </div>

          <div className="pt-2 pb-1 flex justify-center">
            <div className="w-24 h-1 bg-slate-600 rounded-full" />
          </div>
        </div>
      </div>

      {/* FRASES EM DESTAQUE ABAIXO DOS DEPOIMENTOS */}
      <div className="pt-2 pb-1 text-center max-w-xl mx-auto px-2 space-y-2">
        <div className="bg-[#F0FDF4] border-2 border-[#38A169] rounded-2xl p-4 sm:p-5 shadow-sm">
          <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-snug">
            Viva sem medo da próxima refeição
          </h3>
          <p className="text-sm sm:text-base md:text-lg font-black text-[#276749] mt-1.5 uppercase tracking-wide flex items-center justify-center gap-1.5">
            <span className="text-[#38A169]">✓</span>
            <span>Elimina todos parasitas do seu corpo</span>
          </p>
        </div>
      </div>

      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-medium bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-full shadow-sm">
          <span className="w-2 h-2 rounded-full bg-[#38A169] animate-pulse"></span>
          Relatos autênticos e verificados • Pacientes do Protocolo
        </span>
      </div>
    </section>
  );
});

/* 8. OFERTA & PACOTE COM VALOR ANCORADO */
const CHECKOUT_LINK = 'https://pay.wiapy.com/YYrHEH5EzLbR';

interface OfferSectionProps {
  onOpenCheckout?: () => void;
  offerRef: React.RefObject<HTMLDivElement | null>;
}

const OfferSection = memo(function OfferSection({ onOpenCheckout, offerRef }: OfferSectionProps) {
  return (
    <section
      ref={offerRef}
      aria-label="Oferta e Estrutura de Preço"
      className="space-y-6 pt-2"
    >
      <div className="bg-white border-2 border-[#38A169] rounded-3xl p-5 sm:p-8 shadow-md relative space-y-6">
        <div className="text-center space-y-1">
          <span className="inline-block px-3 py-1 rounded-full bg-[#38A169]/10 text-[#2F855A] text-xs font-bold tracking-wide uppercase">
            Acesso Imediato Liberado
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
            O seu protocolo Exclusivo está pronto!
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
            Confira tudo o que está incluso no seu pacote completo de desparasitação e recuperação metabólica:
          </p>
        </div>

        {/* STACK DE VALOR ANCORADO */}
        <div className="bg-[#F7FAFC] border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-2.5">
          <div className="flex items-center justify-between text-xs sm:text-sm py-2 border-b border-slate-200/70">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#38A169] shrink-0" />
              <span className="text-slate-800 font-semibold">Preparação para desparasitação</span>
            </div>
            <span className="text-slate-400 line-through font-mono">R$ 47,00</span>
          </div>

          <div className="flex items-center justify-between text-xs sm:text-sm py-2 border-b border-slate-200/70">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#38A169] shrink-0" />
              <span className="text-slate-800 font-semibold">Desparasitação completa (Protocolo + Vitamina)</span>
            </div>
            <span className="text-slate-400 line-through font-mono">R$ 67,00</span>
          </div>

          <div className="flex items-center justify-between text-xs sm:text-sm py-2 border-b border-slate-200/70">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#38A169] shrink-0" />
              <span className="text-slate-800 font-semibold">Guia alimentar CARDÁPIO</span>
            </div>
            <span className="text-slate-400 line-through font-mono">R$ 47,00</span>
          </div>

          <div className="flex items-center justify-between text-xs sm:text-sm py-2 border-b border-slate-200/70">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#38A169] shrink-0" />
              <span className="text-slate-800 font-semibold">RECEITAS PARA DIABÉTICOS</span>
            </div>
            <span className="text-slate-400 line-through font-mono">R$ 57,00</span>
          </div>

          <div className="flex items-center justify-between text-xs sm:text-sm py-2">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#38A169] shrink-0" />
              <span className="text-slate-800 font-semibold">RECEITAS DETOX PARA EMAGRECER</span>
            </div>
            <span className="text-slate-400 line-through font-mono">R$ 54,00</span>
          </div>
        </div>

        {/* PACOTE DE R$ 37,90 EM DESTAQUE PULSANDO */}
        <div className="relative p-5 sm:p-7 rounded-3xl bg-gradient-to-b from-[#F0FDF4] via-white to-[#F0FDF4] border-2 border-[#38A169] text-center space-y-4 animate-pulse-package">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#38A169] text-white text-[11px] font-black uppercase tracking-wider shadow-sm">
            <span className="w-2 h-2 rounded-full bg-yellow-300 animate-ping" />
            <span>OFERTA ESPECIAL LIBERADA HOJE</span>
          </div>

          <div>
            <span className="text-xs text-slate-500 font-bold block uppercase tracking-wide">
              Valor Total de Todos os Módulos:
            </span>
            <span className="text-slate-400 line-through text-lg font-mono font-bold">
              De R$ 272,00
            </span>
          </div>

          <div className="py-1">
            <span className="text-xs sm:text-sm font-black text-[#276749] uppercase tracking-wide block">
              Por Apenas Pagamento Único:
            </span>
            <div className="flex items-baseline justify-center gap-1.5 my-1">
              <span className="text-2xl sm:text-3xl text-[#2F855A] font-extrabold font-mono">R$</span>
              <span className="text-5xl sm:text-7xl font-black text-[#276749] tracking-tight font-mono drop-shadow-[0_2px_8px_rgba(56,161,105,0.25)]">
                37,90
              </span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white border border-[#38A169]/40 text-[#276749] text-xs font-bold">
              <span>✓ Sem mensalidades</span>
              <span>•</span>
              <span>Acesso Imediato</span>
            </div>
          </div>

          {/* BOTÃO CTA VERDE DE DESTAQUE COM REDIRECIONAMENTO DIRETO */}
          <div className="pt-2">
            <a
              href={CHECKOUT_LINK}
              onClick={() => {
                if (typeof window !== 'undefined' && (window as any).fbq) {
                  try {
                    (window as any).fbq('track', 'InitiateCheckout', { currency: 'BRL', value: 37.90 });
                  } catch {
                    // Safe handling
                  }
                }
              }}
              className="w-full sm:w-auto sm:min-w-[340px] px-8 py-4 sm:py-5 rounded-full bg-[#38A169] hover:bg-[#2F855A] active:bg-[#276749] text-white font-black text-base sm:text-xl uppercase tracking-wider shadow-lg shadow-[#38A169]/35 hover:shadow-xl transition-all transform active:scale-95 cursor-pointer inline-flex items-center justify-center gap-2 border-2 border-emerald-300 text-center"
            >
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
              <span>Acessar meu Protocolo Agora!</span>
            </a>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500 pt-2 border-t border-[#38A169]/15">
            <span className="flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-[#38A169]" />
              Pagamento Seguro
            </span>
            <span className="flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-[#38A169]" />
              Acesso Imediato
            </span>
            <span className="flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-[#38A169]" />
              Garantia de 30 Dias
            </span>
          </div>
        </div>
      </div>
    </section>
  );
});

/* 9. GARANTIA & FAQ */
const GuaranteeFaqSection = memo(function GuaranteeFaqSection() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <section aria-label="Garantia e Perguntas Frequentes" className="space-y-8">
      {/* SELO DE GARANTIA INCONDICIONAL DE 30 DIAS */}
      <div className="bg-[#F7FAFC] border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-5">
        <div className="w-20 h-20 rounded-full bg-[#EBF8F2] border-2 border-[#38A169] flex flex-col items-center justify-center text-center text-[#276749] shrink-0">
          <Award className="w-7 h-7 stroke-[2]" />
          <span className="text-[10px] uppercase font-bold leading-none mt-1">Garantia</span>
          <span className="text-xs font-black">30 DIAS</span>
        </div>

        <div className="space-y-1.5 text-center sm:text-left">
          <span className="inline-block px-2.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold uppercase">
            Código de Defesa do Consumidor Art. 49
          </span>
          <h3 className="font-bold text-slate-900 text-base sm:text-lg">
            Garantia Incondicional de 30 Dias (Risco Zero)
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Você pode testar todo o protocolo por 30 dias com tranquilidade. Se por qualquer motivo não notar melhorias nítidas na sua disposição ou nos níveis de glicose no sangue, devolvemos 100% do seu dinheiro sem questionamentos.
          </p>
        </div>
      </div>

      {/* PERGUNTAS FREQUENTES (ACORDEÃO RETRÁTIL) */}
      <div className="space-y-4">
        <div className="text-center space-y-1">
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
            Perguntas Frequentes (FAQ)
          </h3>
          <p className="text-xs sm:text-sm text-slate-500">
            Clique na dúvida para ver a resposta detalhada:
          </p>
        </div>

        <div className="space-y-2.5">
          {FAQ_ITEMS.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="border border-slate-200 rounded-xl bg-white overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full p-4 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <span className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-[#38A169] shrink-0" />
                    {faq.q}
                  </span>
                  <div className="text-slate-400 shrink-0">
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-1 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 bg-[#F7FAFC]">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
});

/* 10. NOTIFICAÇÃO DE COMPRA AUTOMÁTICA ISOLADA (NÃO RE-RENDERIZA A PÁGINA) */
const PurchaseNotificationToast = memo(function PurchaseNotificationToast() {
  const [currentPurchase, setCurrentPurchase] = useState<typeof PURCHASES_LIST[0] | null>(null);

  useEffect(() => {
    let index = 0;
    const initialTimer = setTimeout(() => {
      setCurrentPurchase(PURCHASES_LIST[0]);
      setTimeout(() => setCurrentPurchase(null), 5000);
    }, 3000);

    const interval = setInterval(() => {
      index = (index + 1) % PURCHASES_LIST.length;
      setCurrentPurchase(PURCHASES_LIST[index]);
      setTimeout(() => {
        setCurrentPurchase(null);
      }, 5000);
    }, 9000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  if (!currentPurchase) return null;

  return (
    <div className="fixed top-4 sm:top-5 right-3 sm:right-6 z-50 max-w-xs sm:max-w-sm bg-white/95 backdrop-blur-md border-2 border-[#38A169] rounded-2xl p-3.5 shadow-2xl shadow-slate-900/15 flex items-start gap-3 transition-all">
      <div className="w-9 h-9 rounded-full bg-[#EBF8F2] text-[#38A169] flex items-center justify-center shrink-0 border border-[#38A169]/30 mt-0.5">
        <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
      </div>
      <div className="flex-1 min-w-0 pr-1">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#38A169] bg-[#EBF8F2] px-2 py-0.5 rounded-full">
            Compra Confirmada
          </span>
          <span className="text-[10px] text-slate-400 font-medium">{currentPurchase.time}</span>
        </div>
        <p className="text-xs font-bold text-slate-900 mt-1 truncate">
          {currentPurchase.name}
        </p>
        <p className="text-[11px] text-slate-600 font-medium">
          {currentPurchase.city} - {currentPurchase.uf}
        </p>
        <p className="text-[11px] font-extrabold text-[#276749] mt-0.5">
          ✓ Comprou o Pacote Completo (R$ 37,90)
        </p>
      </div>
      <button
        type="button"
        onClick={() => setCurrentPurchase(null)}
        className="text-slate-400 hover:text-slate-600 p-0.5 rounded-full cursor-pointer"
        aria-label="Fechar notificação"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
});

/* 11. MODAL DE CHECKOUT ISOLADO */
interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CheckoutModal = memo(function CheckoutModal({ isOpen, onClose }: CheckoutModalProps) {
  const [paymentType, setPaymentType] = useState<'pix' | 'cartao'>('pix');
  const [buyerName, setBuyerName] = useState<string>('');
  const [buyerEmail, setBuyerEmail] = useState<string>('');
  const [buyerPhone, setBuyerPhone] = useState<string>('');
  const [isSuccessPaid, setIsSuccessPaid] = useState<boolean>(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-xl space-y-5 relative my-8">
        <button
          type="button"
          onClick={() => {
            onClose();
            setIsSuccessPaid(false);
          }}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {!isSuccessPaid ? (
          <>
            <div className="text-center space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#38A169] bg-[#EBF8F2] px-2.5 py-0.5 rounded-full">
                Ambiente Criptografado
              </span>
              <h3 className="text-xl font-black text-slate-900 pt-1">
                Liberar Meu Protocolo
              </h3>
              <p className="text-xs text-slate-500">
                Acesso imediato no valor promocional de R$ 37,90
              </p>
            </div>

            <div className="space-y-3 pt-1">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nome Completo:
                </label>
                <input
                  type="text"
                  placeholder="Seu nome"
                  value={buyerName}
                  onChange={e => setBuyerName(e.target.value)}
                  className="w-full bg-[#F7FAFC] border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#38A169]"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  E-mail (onde você receberá o material):
                </label>
                <input
                  type="email"
                  placeholder="seuemail@exemplo.com"
                  value={buyerEmail}
                  onChange={e => setBuyerEmail(e.target.value)}
                  className="w-full bg-[#F7FAFC] border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#38A169]"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  WhatsApp com DDD:
                </label>
                <input
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={buyerPhone}
                  onChange={e => setBuyerPhone(e.target.value)}
                  className="w-full bg-[#F7FAFC] border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#38A169]"
                />
              </div>
            </div>

            {/* Forma de Pagamento */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 block">
                Forma de Pagamento:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentType('pix')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                    paymentType === 'pix'
                      ? 'bg-[#EBF8F2] border-[#38A169] text-[#276749]'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  <span>PIX (Instantâneo)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentType('cartao')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                    paymentType === 'cartao'
                      ? 'bg-[#EBF8F2] border-[#38A169] text-[#276749]'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Cartão</span>
                </button>
              </div>
            </div>

            {/* Resumo do Pedido */}
            <div className="bg-[#F7FAFC] p-3.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-slate-800 block">Protocolo Glicose Zero</span>
                <span className="text-slate-500">Pacote Completo + 6 Módulos</span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 line-through block text-[11px]">R$ 272,00</span>
                <span className="text-base font-extrabold text-[#276749] font-mono">R$ 37,90</span>
              </div>
            </div>

            {/* Botão Final */}
            <a
              href={CHECKOUT_LINK}
              className="w-full py-3.5 rounded-xl bg-[#38A169] hover:bg-[#2F855A] text-white font-extrabold text-sm uppercase tracking-wide shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 text-center"
            >
              <Lock className="w-4 h-4" />
              <span>Confirmar e Acessar por R$ 37,90</span>
            </a>
          </>
        ) : (
          <div className="text-center py-6 space-y-4">
            <div className="w-14 h-14 rounded-full bg-[#EBF8F2] text-[#38A169] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">
              Acesso Liberado com Sucesso!
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
              Enviamos o material completo com a receita da vitamina de abacate e o guia alimentar para o seu e-mail e WhatsApp.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-[#38A169] text-white font-bold rounded-full text-xs hover:bg-[#2F855A] cursor-pointer"
            >
              Fechar Janela
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

/* COMPONENTE PRINCIPAL OTIMIZADO */
export default function App() {
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [hasAnalyzed, setHasAnalyzed] = useState<boolean>(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);

  const analysisRef = useRef<HTMLDivElement>(null);
  const offerRef = useRef<HTMLDivElement>(null);

  const handleAnalyze = useCallback(() => {
    setIsAnalyzing(true);
    setTimeout(() => {
      analysisRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);

    setTimeout(() => {
      setIsAnalyzing(false);
      setHasAnalyzed(true);
    }, 1500);
  }, []);

  const handleScrollToOffer = useCallback(() => {
    offerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleOpenCheckout = useCallback(() => {
    setIsCheckoutOpen(true);
  }, []);

  const handleCloseCheckout = useCallback(() => {
    setIsCheckoutOpen(false);
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased flex flex-col selection:bg-[#38A169] selection:text-white">
      {/* 1. CABEÇALHO */}
      <Header />

      {/* 2. PROGRESS TRACKER */}
      <ProgressTracker hasAnalyzed={hasAnalyzed} />

      <main className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-12">
        {/* 3. HERO COM VÍDEO DO DOUTOR */}
        <HeroSection />

        {/* 4. QUIZ INTERATIVO COM ESTADO ISOLADO */}
        <QuizSection onAnalyze={handleAnalyze} isAnalyzing={isAnalyzing} />

        {/* 5. ANÁLISE DE SINTOMAS & DIAGNÓSTICO */}
        <div ref={analysisRef}>
          {hasAnalyzed && <AnalysisSection onScrollToOffer={handleScrollToOffer} />}
        </div>

        {/* 6. TABELA COMPARATIVA */}
        <ComparisonSection />

        {/* 7. DEPOIMENTOS DE PACIENTES */}
        <TestimonialsSection />

        {/* 8. OFERTA & PACOTE DE R$ 37,90 */}
        <OfferSection onOpenCheckout={handleOpenCheckout} offerRef={offerRef} />

        {/* 9. GARANTIA & FAQ */}
        <GuaranteeFaqSection />

        {/* 10. RODAPÉ */}
        <footer className="border-t border-slate-200 pt-8 pb-10 text-center text-xs text-slate-500 space-y-3">
          <div className="flex items-center justify-center gap-2">
            <Leaf className="w-4 h-4 text-[#38A169]" />
            <span className="font-bold text-slate-700">Protocolo Glicose Zero & Desparasitação Natural</span>
          </div>
          <p className="max-w-md mx-auto text-[11px] text-slate-500 leading-relaxed">
            As orientações nutricionais e receitas naturais têm finalidade informativa de saúde metabólica. Sempre siga as orientações do seu médico de confiança.
          </p>
          <p className="text-[11px] text-slate-400">
            © 2026 Todos os direitos reservados.
          </p>
        </footer>
      </main>

      {/* NOTIFICAÇÃO DE COMPRA AUTOMÁTICA ISOLADA */}
      <PurchaseNotificationToast />

      {/* MODAL DE CHECKOUT */}
      <CheckoutModal isOpen={isCheckoutOpen} onClose={handleCloseCheckout} />
    </div>
  );
}
