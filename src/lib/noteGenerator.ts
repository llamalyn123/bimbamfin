import { SupportedLanguage } from '../i18n/translations';
import { NoteConceptBlock, MasterNoteContent } from './supabase';

export interface ClaudeNoteGenerationRequest {
  prompt: string;
  displayLanguage: SupportedLanguage;
  course: string;
  week: number | string;
}

/**
 * Builds the exact prompt specification required for Claude API note generation:
 * "Generate this master note in [student's selected language] as the
 * primary language. For each concept block, also include an English
 * translation of the heading and explanation in separate fields
 * (heading_en, explanation_en), so the UI can show the primary-language
 * text with an English subtitle beneath it. Keep source citations
 * exactly as they appear in the original material, untranslated."
 */
export function buildClaudeNotePrompt(
  displayLanguage: SupportedLanguage,
  course: string = 'FIN 301',
  week: number | string = 4
): string {
  const languageNames: Record<SupportedLanguage, string> = {
    en: 'English',
    zh: 'Chinese (Simplified)',
    ta: 'Tamil',
    de: 'German'
  };

  const targetLang = languageNames[displayLanguage] || 'English';

  return `Generate this master note in ${targetLang} as the primary language. For each concept block, also include an English translation of the heading and explanation in separate fields (heading_en, explanation_en), so the UI can show the primary-language text with an English subtitle beneath it. Keep source citations exactly as they appear in the original material, untranslated.`;
}

// Master curriculum note database containing primary language & English translations
export const MULTILINGUAL_MASTER_NOTES: Record<SupportedLanguage, NoteConceptBlock[]> = {
  en: [
    {
      id: 'c1',
      code: '01',
      heading: 'Weighted Average Cost of Capital (WACC)',
      heading_en: 'Weighted Average Cost of Capital (WACC)',
      explanation: "The firm's aggregate hurdle rate calculated by weighting the market returns required by both equity holders and debt providers. Because interest payments are tax-deductible in modern jurisdictions, the debt portion captures the interest tax shield: r_WACC = (E/V)r_E + (D/V)r_D(1 - T_c).",
      explanation_en: "The firm's aggregate hurdle rate calculated by weighting the market returns required by both equity holders and debt providers. Because interest payments are tax-deductible in modern jurisdictions, the debt portion captures the interest tax shield: r_WACC = (E/V)r_E + (D/V)r_D(1 - T_c).",
      source: 'Slide 14, 18',
      formula: 'WACC = (E/V)re + (D/V)rd(1 - tc)',
      references: ['Slide 14, 18', 'Problem Set 2 (§3)']
    },
    {
      id: 'c2',
      code: '02',
      heading: 'Modigliani-Miller Theorem (Proposition I & II)',
      heading_en: 'Modigliani-Miller Theorem (Proposition I & II)',
      explanation: 'Under strict frictionless market assumptions (no taxes, zero transaction costs, symmetric information, equal borrowing rates), enterprise value is entirely independent of its financing mix (Prop I: V_L = V_U). However, Proposition II proves that leverage is not free: the required return on equity climbs linearly with the debt-to-equity ratio: re = r0 + (r0 - rd)(1 - tc)(D/E), exactly offsetting the cheapness of debt.',
      explanation_en: 'Under strict frictionless market assumptions (no taxes, zero transaction costs, symmetric information, equal borrowing rates), enterprise value is entirely independent of its financing mix (Prop I: V_L = V_U). However, Proposition II proves that leverage is not free: the required return on equity climbs linearly with the debt-to-equity ratio: re = r0 + (r0 - rd)(1 - tc)(D/E), exactly offsetting the cheapness of debt.',
      source: 'Reading 2, p. 112',
      formula: 're = r0 + (r0 - rd)(1 - tc)(D/E)',
      references: ['Reading 2, p. 112']
    },
    {
      id: 'c3',
      code: '03',
      heading: 'Optimal Debt Ratio & Bankruptcy Costs',
      heading_en: 'Optimal Debt Ratio & Bankruptcy Costs',
      explanation: 'The modern Static Trade-Off Theory balances the present value of marginal tax deductions against expected costs of direct and indirect financial distress. Direct costs include legal and trustee receivership fees; indirect costs involve supplier defections, brain drain, and underinvestment.',
      explanation_en: 'The modern Static Trade-Off Theory balances the present value of marginal tax deductions against expected costs of direct and indirect financial distress. Direct costs include legal and trustee receivership fees; indirect costs involve supplier defections, brain drain, and underinvestment.',
      source: 'Slide 22',
      isDiscrepancy: true,
      discrepancyTitle: 'Source Variance Detected: Empirical Leverage Limits',
      discrepancyText: 'Lecture Slide 22 indicates that optimal leverage ratio peaks at 35% for cyclical industrial firms, whereas Berk & DeMarzo (Chapter 16, pg. 129) empirically demonstrates capital tolerance up to 45% when supported by secondary asset collateral and liquid receivables.',
      references: ['Slide 22', 'Reading 2, p. 129']
    },
    {
      id: 'c4',
      code: '04',
      heading: 'Cost of Equity Estimation (CAPM vs DDM)',
      heading_en: 'Cost of Equity Estimation (CAPM vs DDM)',
      explanation: 'The Capital Asset Pricing Model (CAPM) remains the primary institutional benchmark: r_E = r_f + beta_L[E(R_m) - r_f]. Professor highlights that the 10-year Treasury yield must be consistently matched to cash flow horizons. Dividend Discount Models (DDM) are reserved only for mature utility operations with predictable payout trajectories.',
      explanation_en: 'The Capital Asset Pricing Model (CAPM) remains the primary institutional benchmark: r_E = r_f + beta_L[E(R_m) - r_f]. Professor highlights that the 10-year Treasury yield must be consistently matched to cash flow horizons. Dividend Discount Models (DDM) are reserved only for mature utility operations with predictable payout trajectories.',
      source: 'Lecture Notes & Prof. Annotation',
      references: ['Lecture Notes & Prof. Annotation']
    },
    {
      id: 'c5',
      code: '05',
      heading: 'Flotation Costs & Net Present Value',
      heading_en: 'Flotation Costs & Net Present Value',
      explanation: 'Critical exam pitfall: Flotation costs must be subtracted as an immediate Year 0 initial cash outlay (CF0 = -(Cost + Flotation)), rather than artificially increasing the ongoing WACC discount rate in future periods, which unfairly compounds the penalty against long-term projects.',
      explanation_en: 'Critical exam pitfall: Flotation costs must be subtracted as an immediate Year 0 initial cash outlay (CF0 = -(Cost + Flotation)), rather than artificially increasing the ongoing WACC discount rate in future periods, which unfairly compounds the penalty against long-term projects.',
      source: 'Slide 29',
      references: ['Slide 29']
    }
  ],

  zh: [
    {
      id: 'c1',
      code: '01',
      heading: '加权平均资本成本 (WACC)',
      heading_en: 'Weighted Average Cost of Capital (WACC)',
      explanation: '企业综合基准回报率，通过权衡股权持有人和债务提供者要求的市场收益率计算得出。由于在现代税制中利息支付可抵扣税款，债务部分享受利息税盾优惠：r_WACC = (E/V)r_E + (D/V)r_D(1 - T_c)。',
      explanation_en: "The firm's aggregate hurdle rate calculated by weighting the market returns required by both equity holders and debt providers. Because interest payments are tax-deductible in modern jurisdictions, the debt portion captures the interest tax shield: r_WACC = (E/V)r_E + (D/V)r_D(1 - T_c).",
      source: 'Slide 14, 18',
      formula: 'WACC = (E/V)re + (D/V)rd(1 - tc)',
      references: ['Slide 14, 18', 'Problem Set 2 (§3)']
    },
    {
      id: 'c2',
      code: '02',
      heading: '莫迪利亚尼-米勒定理 (命题 I 和 II)',
      heading_en: 'Modigliani-Miller Theorem (Proposition I & II)',
      explanation: '在严格的无摩擦市场假设下（无税收、零交易成本、信息对称、借贷利率平等），企业市场价值完全独立于其融资组合（命题 I: V_L = V_U）。然而，命题 II 证明财务杠杆并非无偿：权益回报率随着负债权益比呈线性递增：re = r0 + (r0 - rd)(1 - tc)(D/E)，正好抵消廉价债务的成本优势。',
      explanation_en: 'Under strict frictionless market assumptions (no taxes, zero transaction costs, symmetric information, equal borrowing rates), enterprise value is entirely independent of its financing mix (Prop I: V_L = V_U). However, Proposition II proves that leverage is not free: the required return on equity climbs linearly with the debt-to-equity ratio: re = r0 + (r0 - rd)(1 - tc)(D/E), exactly offsetting the cheapness of debt.',
      source: 'Reading 2, p. 112',
      formula: 're = r0 + (r0 - rd)(1 - tc)(D/E)',
      references: ['Reading 2, p. 112']
    },
    {
      id: 'c3',
      code: '03',
      heading: '最优债务比率与破产成本',
      heading_en: 'Optimal Debt Ratio & Bankruptcy Costs',
      explanation: '现代静态权衡理论权衡边际税收减免的现值与直接和间接财务困境的预期成本。直接成本包括破产法律诉讼和接管清算费；间接成本包括供应商流失、核心人才流失以及投资不足。',
      explanation_en: 'The modern Static Trade-Off Theory balances the present value of marginal tax deductions against expected costs of direct and indirect financial distress. Direct costs include legal and trustee receivership fees; indirect costs involve supplier defections, brain drain, and underinvestment.',
      source: 'Slide 22',
      isDiscrepancy: true,
      discrepancyTitle: 'Source Variance Detected: Empirical Leverage Limits',
      discrepancyText: '讲义 Slide 22 指出周期性工业公司的最优杠杆率峰值为 35%，而 Berk & DeMarzo（第 16 章第 129 页）实证表明在拥有次级资产抵押和流动应收账款支持时，资本容忍度可达 45%。',
      references: ['Slide 22', 'Reading 2, p. 129']
    },
    {
      id: 'c4',
      code: '04',
      heading: '权益成本估算 (CAPM 对比 DDM)',
      heading_en: 'Cost of Equity Estimation (CAPM vs DDM)',
      explanation: '资本资产定价模型 (CAPM) 仍是主要机构基准：r_E = r_f + beta_L[E(R_m) - r_f]。教授特别强调10年期国债收益率必须与现金流期限保持一致。股利贴现模型 (DDM) 仅适用于具有可预测分红轨迹的成熟公用事业公司。',
      explanation_en: 'The Capital Asset Pricing Model (CAPM) remains the primary institutional benchmark: r_E = r_f + beta_L[E(R_m) - r_f]. Professor highlights that the 10-year Treasury yield must be consistently matched to cash flow horizons. Dividend Discount Models (DDM) are reserved only for mature utility operations with predictable payout trajectories.',
      source: 'Lecture Notes & Prof. Annotation',
      references: ['Lecture Notes & Prof. Annotation']
    },
    {
      id: 'c5',
      code: '05',
      heading: '发行费用与净现值 (NPV)',
      heading_en: 'Flotation Costs & Net Present Value',
      explanation: '关键考试陷阱：发行成本必须作为第0年的即时初始现金流出予以扣除 (CF0 = -(成本 + 发行费用))，而不是人为提高未来期间的 WACC 折现率，否则会对长期项目造成不公平的复合惩罚。',
      explanation_en: 'Critical exam pitfall: Flotation costs must be subtracted as an immediate Year 0 initial cash outlay (CF0 = -(Cost + Flotation)), rather than artificially increasing the ongoing WACC discount rate in future periods, which unfairly compounds the penalty against long-term projects.',
      source: 'Slide 29',
      references: ['Slide 29']
    }
  ],

  ta: [
    {
      id: 'c1',
      code: '01',
      heading: 'மூலதனத்தின் எடையிடப்பட்ட சராசரி செலவு (WACC)',
      heading_en: 'Weighted Average Cost of Capital (WACC)',
      explanation: 'பங்குதாரர்கள் மற்றும் கடன் வழங்குநர்கள் எதிர்பார்க்கும் சந்தை வருவாயை எடையிடுவதன் மூலம் கணக்கிடப்படும் நிறுவனத்தின் குறைந்தபட்ச முதலீட்டு வரம்பு. நவீன அதிகார வரம்புகளில் வட்டி செலுத்துதல்கள் வரிவிலக்குக்குரியவை என்பதால், கடன் பகுதி வரி கேடயப் பயனைப் பெறுகிறது: r_WACC = (E/V)r_E + (D/V)r_D(1 - T_c).',
      explanation_en: "The firm's aggregate hurdle rate calculated by weighting the market returns required by both equity holders and debt providers. Because interest payments are tax-deductible in modern jurisdictions, the debt portion captures the interest tax shield: r_WACC = (E/V)r_E + (D/V)r_D(1 - T_c).",
      source: 'Slide 14, 18',
      formula: 'WACC = (E/V)re + (D/V)rd(1 - tc)',
      references: ['Slide 14, 18', 'Problem Set 2 (§3)']
    },
    {
      id: 'c2',
      code: '02',
      heading: 'மோடிக்லியானி-மில்லர் தேற்றம் (முன்மொழிவு I & II)',
      heading_en: 'Modigliani-Miller Theorem (Proposition I & II)',
      explanation: 'உராய்வற்ற சந்தை அனுமானங்களின் கீழ் (வரிகள் இல்லை, பரிவர்த்தனை செலவுகள் பூஜ்ஜியம், சமச்சீர் தகவல்), நிறுவனத்தின் மதிப்பு அதன் மூலதனக் கலவையைச் சார்ந்திருக்காது (Prop I: V_L = V_U). ஆனால் முன்மொழிவு II கடன் இலவசமல்ல என்பதை நிரூபிக்கிறது: கடன்-பங்கு விகிதத்திற்கு ஏற்ப பங்கு வருவாய் நேர்கோட்டில் உயர்கிறது: re = r0 + (r0 - rd)(1 - tc)(D/E).',
      explanation_en: 'Under strict frictionless market assumptions (no taxes, zero transaction costs, symmetric information, equal borrowing rates), enterprise value is entirely independent of its financing mix (Prop I: V_L = V_U). However, Proposition II proves that leverage is not free: the required return on equity climbs linearly with the debt-to-equity ratio: re = r0 + (r0 - rd)(1 - tc)(D/E), exactly offsetting the cheapness of debt.',
      source: 'Reading 2, p. 112',
      formula: 're = r0 + (r0 - rd)(1 - tc)(D/E)',
      references: ['Reading 2, p. 112']
    },
    {
      id: 'c3',
      code: '03',
      heading: 'உகந்த கடன் விகிதம் மற்றும் திவால் செலவுகள்',
      heading_en: 'Optimal Debt Ratio & Bankruptcy Costs',
      explanation: 'நவீன நிலையான சமநிலை கோட்பாடு வரி விலக்குகளின் தற்போதைய மதிப்பை நிதி நெருக்கடி செலவுகளுடன் சமன் செய்கிறது. நேரடி செலவுகளில் சட்ட மற்றும் அறங்காவலர் கட்டணங்கள் அடங்கும்; மறைமுக செலவுகளில் வாடிக்கையாளர் இழப்பு மற்றும் முதலீட்டு பற்றாக்குறை அடங்கும்.',
      explanation_en: 'The modern Static Trade-Off Theory balances the present value of marginal tax deductions against expected costs of direct and indirect financial distress. Direct costs include legal and trustee receivership fees; indirect costs involve supplier defections, brain drain, and underinvestment.',
      source: 'Slide 22',
      isDiscrepancy: true,
      discrepancyTitle: 'Source Variance Detected: Empirical Leverage Limits',
      discrepancyText: 'விரிவுரை Slide 22 தொழில்துறை நிறுவனங்களுக்கான உகந்த கடன் விகித உச்சம் 35% எனக் காட்டுகிறது, அதேசமயம் Berk & DeMarzo (அத்தியாயம் 16, பக். 129) இரண்டாம் நிலை சொத்து பிணையத்துடன் 45% வரை தாங்கும் தன்மையை நிரூபிக்கிறது.',
      references: ['Slide 22', 'Reading 2, p. 129']
    },
    {
      id: 'c4',
      code: '04',
      heading: 'பங்கு மூலதனச் செலவு மதிப்பீடு (CAPM vs DDM)',
      heading_en: 'Cost of Equity Estimation (CAPM vs DDM)',
      explanation: 'மூலதன சொத்து விலை நிர்ணய மாதிரி (CAPM) முதன்மை நிறுவன அளவுகோலாக உள்ளது: r_E = r_f + beta_L[E(R_m) - r_f]. 10 ஆண்டு கருவூலப் பத்திர வருவாய் பணப்புழக்க கால அவகாசத்துடன் பொருந்த வேண்டும் என்பதை பேராசிரியர் வலியுறுத்துகிறார். ஈவுத்தொகை தள்ளுபடி மாதிரி (DDM) முதிர்ந்த நிறுவனங்களுக்கு மட்டுமே பயன்படுகிறது.',
      explanation_en: 'The Capital Asset Pricing Model (CAPM) remains the primary institutional benchmark: r_E = r_f + beta_L[E(R_m) - r_f]. Professor highlights that the 10-year Treasury yield must be consistently matched to cash flow horizons. Dividend Discount Models (DDM) are reserved only for mature utility operations with predictable payout trajectories.',
      source: 'Lecture Notes & Prof. Annotation',
      references: ['Lecture Notes & Prof. Annotation']
    },
    {
      id: 'c5',
      code: '05',
      heading: 'பங்கு வெளியீட்டுச் செலவுகள் மற்றும் நிகர தற்போதைய மதிப்பு',
      heading_en: 'Flotation Costs & Net Present Value',
      explanation: 'முக்கிய தேர்வு குறிப்பு: வெளியீட்டுச் செலவுகள் உடனடியாக ஆண்டு 0 ஆரம்ப பண வெளியேற்றமாக கழிக்கப்பட வேண்டும் (CF0 = -(செலவு + வெளியீடு)), மாறாக எதிர்கால WACC தள்ளுபடி விகிதத்தை செயற்கையாக அதிகரிக்கக்கூடாது, இது நீண்ட கால திட்டங்களுக்கு பாதகத்தை ஏற்படுத்தும்.',
      explanation_en: 'Critical exam pitfall: Flotation costs must be subtracted as an immediate Year 0 initial cash outlay (CF0 = -(Cost + Flotation)), rather than artificially increasing the ongoing WACC discount rate in future periods, which unfairly compounds the penalty against long-term projects.',
      source: 'Slide 29',
      references: ['Slide 29']
    }
  ],

  de: [
    {
      id: 'c1',
      code: '01',
      heading: 'Gewichtete durchschnittliche Kapitalkosten (WACC)',
      heading_en: 'Weighted Average Cost of Capital (WACC)',
      explanation: 'Der aggregierte Mindestzinssatz eines Unternehmens, berechnet durch die Gewichtung der von Eigen- und Fremdkapitalgebern geforderten Marktrenditen. Da Zinszahlungen steuerlich absetzbar sind, fängt der Fremdkapitalanteil den Zinssteuerschild auf: r_WACC = (E/V)r_E + (D/V)r_D(1 - T_c).',
      explanation_en: "The firm's aggregate hurdle rate calculated by weighting the market returns required by both equity holders and debt providers. Because interest payments are tax-deductible in modern jurisdictions, the debt portion captures the interest tax shield: r_WACC = (E/V)r_E + (D/V)r_D(1 - T_c).",
      source: 'Slide 14, 18',
      formula: 'WACC = (E/V)re + (D/V)rd(1 - tc)',
      references: ['Slide 14, 18', 'Problem Set 2 (§3)']
    },
    {
      id: 'c2',
      code: '02',
      heading: 'Modigliani-Miller-Theorem (Proposition I & II)',
      heading_en: 'Modigliani-Miller Theorem (Proposition I & II)',
      explanation: 'Unter streng reibungslosen Marktannahmen (keine Steuern, keine Transaktionskosten, symmetrische Information, gleiche Kreditzinsen) ist der Unternehmenswert völlig unabhängig von seiner Finanzierungsstruktur (Prop I: V_L = V_U). Proposition II beweist jedoch, dass Verschuldung nicht kostenlos ist: Die geforderte Eigenkapitalrendite steigt linear mit dem Verschuldungsgrad: re = r0 + (r0 - rd)(1 - tc)(D/E), was den Vorteil des billigen Fremdkapitals genau ausgleicht.',
      explanation_en: 'Under strict frictionless market assumptions (no taxes, zero transaction costs, symmetric information, equal borrowing rates), enterprise value is entirely independent of its financing mix (Prop I: V_L = V_U). However, Proposition II proves that leverage is not free: the required return on equity climbs linearly with the debt-to-equity ratio: re = r0 + (r0 - rd)(1 - tc)(D/E), exactly offsetting the cheapness of debt.',
      source: 'Reading 2, p. 112',
      formula: 're = r0 + (r0 - rd)(1 - tc)(D/E)',
      references: ['Reading 2, p. 112']
    },
    {
      id: 'c3',
      code: '03',
      heading: 'Optimale Verschuldungsquote & Insolvenzkosten',
      heading_en: 'Optimal Debt Ratio & Bankruptcy Costs',
      explanation: 'Die moderne statische Trade-Off-Theorie balanciert den Barwert steuerlicher Vorteile gegen die erwarteten Kosten direkter und indirekter finanzieller Notlagen ab. Direkte Kosten umfassen Anwalts- und Insolvenzverwaltergebühren; indirekte Kosten beinhalten Lieferantenverluste, Abwanderung von Fachkräften und Unterinvestition.',
      explanation_en: 'The modern Static Trade-Off Theory balances the present value of marginal tax deductions against expected costs of direct and indirect financial distress. Direct costs include legal and trustee receivership fees; indirect costs involve supplier defections, brain drain, and underinvestment.',
      source: 'Slide 22',
      isDiscrepancy: true,
      discrepancyTitle: 'Source Variance Detected: Empirical Leverage Limits',
      discrepancyText: 'Vorlesungsfolie 22 zeigt, dass die optimale Verschuldungsquote bei 35% liegt, während Berk & DeMarzo (Kapitel 16, S. 129) empirisch eine Toleranz von bis zu 45% bei Unterstützung durch Sicherheiten nachweist.',
      references: ['Slide 22', 'Reading 2, p. 129']
    },
    {
      id: 'c4',
      code: '04',
      heading: 'Eigenkapitalkostenschätzung (CAPM vs. DDM)',
      heading_en: 'Cost of Equity Estimation (CAPM vs DDM)',
      explanation: 'Das Capital Asset Pricing Model (CAPM) bleibt der institutionelle Standard: r_E = r_f + beta_L[E(R_m) - r_f]. Professor Vance betont, dass die 10-jährige Staatsanleihenrendite konsistent mit den Cashflow-Horizonten abgestimmt sein muss. Dividenden-Discount-Modelle (DDM) sind reifen Versorgungsunternehmen vorbehalten.',
      explanation_en: 'The Capital Asset Pricing Model (CAPM) remains the primary institutional benchmark: r_E = r_f + beta_L[E(R_m) - r_f]. Professor highlights that the 10-year Treasury yield must be consistently matched to cash flow horizons. Dividend Discount Models (DDM) are reserved only for mature utility operations with predictable payout trajectories.',
      source: 'Lecture Notes & Prof. Annotation',
      references: ['Lecture Notes & Prof. Annotation']
    },
    {
      id: 'c5',
      code: '05',
      heading: 'Emissionskosten & Kapitalwert (NPV)',
      heading_en: 'Flotation Costs & Net Present Value',
      explanation: 'Kritische Prüfungsfalle: Emissionskosten müssen als sofortiger anfänglicher Cash-Abfluss in Jahr 0 abgezogen werden (CF0 = -(Kosten + Emission)), anstatt den laufenden WACC-Diskontsatz künstlich zu erhöhen, was langfristige Projekte unverhältnismäßig benachteiligen würde.',
      explanation_en: 'Critical exam pitfall: Flotation costs must be subtracted as an immediate Year 0 initial cash outlay (CF0 = -(Cost + Flotation)), rather than artificially increasing the ongoing WACC discount rate in future periods, which unfairly compounds the penalty against long-term projects.',
      source: 'Slide 29',
      references: ['Slide 29']
    }
  ]
};

export function getMasterNoteForLanguage(
  language: SupportedLanguage,
  course: string = 'FIN 301',
  week: number | string = 4
): MasterNoteContent {
  const titles: Record<SupportedLanguage, string> = {
    en: 'Week 4: Capital Structure & Valuation',
    zh: '第 4 周：资本结构与企业估值',
    ta: 'வாரம் 4: மூலதன அமைப்பு மற்றும் மதிப்பீடு',
    de: 'Woche 4: Kapitalstruktur & Unternehmensbewertung'
  };

  const summaries: Record<SupportedLanguage, string> = {
    en: 'Master synthesis balancing corporate tax shields, distress overhead, and Modigliani-Miller propositions.',
    zh: '权衡企业税盾效应、财务困境成本与莫迪利亚尼-米勒定理的综合学术精编。',
    ta: 'கார்ப்பரேட் வரி கேடயங்கள், நிதி நெருக்கடி செலவுகள் மற்றும் மோடிக்லியானி-மில்லர் முன்மொழிவுகளை சமநிலைப்படுத்தும் முதன்மை தொகுப்பு.',
    de: 'Synthese zur Balance von Steuervorteilen, finanziellen Notlagenkosten und Modigliani-Miller-Theoremen.'
  };

  const concepts = MULTILINGUAL_MASTER_NOTES[language] || MULTILINGUAL_MASTER_NOTES.en;

  return {
    title: titles[language] || titles.en,
    title_en: titles.en,
    docCode: 'DOC-CF-04.8',
    summary: summaries[language] || summaries.en,
    summary_en: summaries.en,
    primaryLanguage: language,
    concepts
  };
}
