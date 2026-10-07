import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://xxlbvcwyicddkjbzbtvu.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4bGJ2Y3d5aWNkZGtqYnpidHZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NzExNjYsImV4cCI6MjEwNjI0NzE2Nn0.8nQrE1Z2t44697Ox9A-NCyd3AcpTl4FkebXKHnuYyvQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export type UniversityAffiliation = 'SMU' | 'NUS' | 'NTU' | 'independent';

export interface ProfileItem {
  id: string;
  email: string;
  university: UniversityAffiliation;
  full_name?: string;
  created_at?: string;
}

/**
 * Institution comes ONLY from the login email's domain (exact domain or a
 * subdomain of it), e.g. jane.2024@scis.smu.edu.sg -> SMU. Not user-editable.
 */
const UNI_DOMAINS: Record<Exclude<UniversityAffiliation, 'independent'>, string[]> = {
  SMU: ['smu.edu.sg'],
  NUS: ['nus.edu.sg', 'u.nus.edu', 'nus.edu'],
  NTU: ['ntu.edu.sg', 'e.ntu.edu.sg']
};

export function inferUniversity(email: string): UniversityAffiliation {
  const domain = (email.toLowerCase().trim().split('@')[1] || '').replace(/\.$/, '');
  for (const [uni, roots] of Object.entries(UNI_DOMAINS)) {
    if (roots.some((r) => domain === r || domain.endsWith(`.${r}`))) return uni as UniversityAffiliation;
  }
  return 'independent';
}

export interface Deadline {
  id: string;
  title: string;
  course: string;
  due_date: string;
  status: 'pending' | 'completed' | 'cleared' | string;
  type: 'Assignment' | 'Quiz' | 'RSVP' | 'Case Study' | string;
  source: string;
  user_id?: string | null;
}

export interface EventItem {
  id: string;
  title: string;
  event_date: string;
  location: string;
  source: string;
  created_at?: string;
  // UI enrichment
  category?: string;
  attendees_count?: number;
  banner_image?: string;
  tags?: string[];
  dress_code?: string;
  notes?: string;
  institution?: 'SMU' | 'NUS' | 'NTU' | 'ALL' | string;
  // Real columns
  registration_deadline?: string | null;
  registration_url?: string | null;
  interest_tags?: string[] | null;
  description?: string | null;
  organiser?: string | null;
  end_date?: string | null;
  created_by?: string | null;
}

export interface ClassItem {
  id: number | string;
  external_id: string;
  course: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
}

export interface ChangeAlert {
  id: number;
  kind: string;
  message: string;
  created_at: string;
}

export interface SourceItem {
  id: string;
  course: string;
  week: number | string;
  file_url: string;
  created_at?: string;
  user_id?: string | null;
  upload_method?: string;
}

export interface NoteConceptBlock {
  id?: string;
  code?: string;
  heading: string;          // primary language (student's selected display language)
  heading_en: string;       // English translation
  explanation: string;      // primary language
  explanation_en: string;   // English translation
  source: string;           // unchanged, citations stay as-is (e.g. "Slide 14, 18")
  formula?: string;
  references?: string[];
  isDiscrepancy?: boolean;
  discrepancyTitle?: string;
  discrepancyText?: string;
  // Compatibility fields
  title?: string;
  body?: string;
}

export interface MasterNoteContent {
  title: string;
  title_en?: string;
  docCode?: string;
  summary?: string;
  summary_en?: string;
  primaryLanguage?: string;
  concepts: NoteConceptBlock[];
}

export interface NoteItem {
  id: string;
  course: string;
  week: number | string;
  content: string;
  created_at?: string;
  user_id?: string | null;
}

export interface QuizItem {
  id: string;
  note_id?: string | null;
  questions: any;
  score?: number | null;
  created_at?: string;
  user_id?: string | null;
}

export interface UserEventInterest {
  id: string;
  event_id: string;
  registered: boolean;
  created_at?: string;
  user_id?: string | null;
}

export interface QuoteItem {
  id: string;
  quote_text: string;
  speaker: string;
  source_title: string;
  type: string;
  tone: string;
  language: string;
}

// Initial seed fallbacks for when database tables have 0 rows
export const INITIAL_DEADLINES: Deadline[] = [
  {
    id: 'd1',
    title: 'Problem Set #3 — Capital Structure & Valuation',
    course: 'FIN 301',
    due_date: '2024-10-25T23:59:00Z',
    status: 'pending',
    type: 'Assignment',
    source: 'Canvas LMS Synced'
  },
  {
    id: 'd2',
    title: 'FinTech Mixer & Resume Review RSVP',
    course: 'Campus Events & RSVPs',
    due_date: '2024-10-25T17:00:00Z',
    status: 'pending',
    type: 'RSVP',
    source: 'Undergrad Guild'
  },
  {
    id: 'd3',
    title: 'Midterm Mastery Active Recall Quiz',
    course: 'ACC 210',
    due_date: '2024-10-27T17:00:00Z',
    status: 'pending',
    type: 'Quiz',
    source: 'Accounting · Dr. Chen'
  },
  {
    id: 'd4',
    title: 'Cash Flow Statement Analysis Case Study',
    course: 'ACC 210',
    due_date: '2024-10-27T23:59:00Z',
    status: 'pending',
    type: 'Assignment',
    source: 'Excel Template (.xlsx)'
  },
  {
    id: 'd5',
    title: 'Market Equilibrium Problem Set #4',
    course: 'ECON 201',
    due_date: '2024-10-29T10:00:00Z',
    status: 'pending',
    type: 'Assignment',
    source: 'Lecture Recitation'
  },
  {
    id: 'd6',
    title: 'Quant Trading & Python Strategies Talk',
    course: 'Campus Events & RSVPs',
    due_date: '2024-10-30T18:00:00Z',
    status: 'pending',
    type: 'RSVP',
    source: 'Guest Speaker Series'
  },
  {
    id: 'd7',
    title: 'Organizational Leadership Reading Check',
    course: 'MGT 250',
    due_date: '2024-11-01T23:59:00Z',
    status: 'pending',
    type: 'Quiz',
    source: 'Open Textbook'
  },
  {
    id: 'd8',
    title: 'Reading Quiz #2 — Capital Budgeting',
    course: 'FIN 301',
    due_date: '2024-10-22T16:12:00Z',
    status: 'completed',
    type: 'Quiz',
    source: 'Submitted on Canvas LMS'
  },
  {
    id: 'd9',
    title: 'Lecture Summary — Consumer Choice Theory',
    course: 'ECON 201',
    due_date: '2024-10-20T11:15:00Z',
    status: 'completed',
    type: 'Assignment',
    source: 'PDF Notes Linked in Vault'
  }
];

export const INITIAL_EVENTS: EventItem[] = [
  {
    id: 'e1',
    title: 'Wall Street & Fintech Networking Night',
    event_date: '2024-10-24T18:30:00Z',
    location: 'Alden Hall Auditorium',
    source: 'Finance Society & Career Office',
    category: 'Finance',
    attendees_count: 85,
    tags: ['#Finance', '#Alumni', '#Catered Dinner'],
    dress_code: 'Business Casual',
    notes: 'Connect with alumni analysts from top bulge bracket banks and fintech startups. Resume drop and speed networking rounds.',
    institution: 'ALL'
  },
  {
    id: 'e2',
    title: 'SMU Connexion FinTech Mixer & Resume Review',
    event_date: '2024-10-24T17:30:00Z',
    location: 'SMU Connexion Rm 204',
    source: 'SMU Undergrad Guild',
    category: 'Networking',
    attendees_count: 42,
    banner_image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBpfiPv9gX5sKjynn9LWBO2G2hJqCC_DfI0Oz9UynpRCej0jbW44J4PorJX6a5p7sgjieyY49W33-3HZyIamxXXSQapy71F4L6kWvm5SSEEogciRtHaW7CJ7WSYx9RJVypKocJWfBRn97T4pBUvAqtCE6_J_qcrQnp4uj67XXdGQKH6yT3UA7lnT4Gta29k_BlsTl-IjFOTmfeWCVrkg2lX7sLDKJ7TnlQ9w9lXkFf8wmzpEP1FSFM',
    tags: ['#Networking', '#SMUExcl', '#ResumeReview'],
    notes: 'Free snacks & 1:1 portfolio reviews with campus alumni. SMU student ID verification.',
    institution: 'SMU'
  },
  {
    id: 'e3',
    title: 'Venture Capital Case Competition Workshop',
    event_date: '2024-10-25T16:00:00Z',
    location: 'Business Tower Rm 302',
    source: 'Undergraduate Guild',
    category: 'Competition',
    attendees_count: 36,
    tags: ['#Competition', '#VentureCapital', '#Workshop'],
    notes: 'Register by today. Practice term sheet modeling with guest judges.',
    institution: 'ALL'
  },
  {
    id: 'e4',
    title: 'NUS UTown McKinsey & Co. Consulting Coffee Chat',
    event_date: '2024-10-25T14:00:00Z',
    location: 'NUS UTown Terrace',
    source: 'NUS Career Development Office',
    category: 'Careers',
    attendees_count: 28,
    tags: ['#Consulting', '#NUSExcl', '#CaseStudy'],
    notes: 'Informal coffee chats with senior business analysts for NUS undergrads. Slots are limited.',
    institution: 'NUS'
  },
  {
    id: 'e5',
    title: 'NTU Hive Economics Society Mixer',
    event_date: '2024-10-26T19:00:00Z',
    location: 'NTU The Hive Lounge',
    source: 'NTU Economics Faculty',
    category: 'Social',
    attendees_count: 50,
    tags: ['#Social', '#NTUExcl', '#DropIn'],
    notes: 'Drop-in social mixer with NTU economics faculty and peer mentors.',
    institution: 'NTU'
  },
  {
    id: 'e6',
    title: 'Midterm Sprint: Accounting Lab',
    event_date: '2024-10-25T15:00:00Z',
    location: 'Library Hub B',
    source: 'Accounting Department',
    category: 'Study Lab',
    attendees_count: 24,
    banner_image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAC-p-9UE7ig-U7pCbnR2A8Q7sgK92wUQaCvoAJV6nGqC5OfPVO0Ohew25IrHP6Aa4V_ni2GbH7VknrlI1OoQCkpc0BdJDJrpBeAjm6N5FD0X59a9UvHCBfCWFLuz5-gZv4DptpLl0TLaD-IpPaZUOh_IIIRmYGNrPYxCB5QpzxIwu98ho0vgVjqUNOOXEi9bcBAO_TQsapdYPAXSWD4a7uPzIxYZZUWnVR20rKVynfa0Z5sqtPI8c',
    tags: ['#Accounting', '#TAOfficeHours', '#MidtermPrep'],
    notes: 'TA peer review and intensive ledger problem sets.',
    institution: 'ALL'
  },
  {
    id: 'e7',
    title: 'Quant Trading & Python Backtesting Workshop',
    event_date: '2024-10-30T18:00:00Z',
    location: 'Quantitative Finance Lab',
    source: 'Computational Finance Guild',
    category: 'Finance',
    attendees_count: 65,
    tags: ['#Quant', '#Python', '#AlgorithmicTrading'],
    notes: 'Hands-on session using historical tick data to test statistical arbitrage and pairs trading models.',
    institution: 'ALL'
  },
  {
    id: 'e8',
    title: 'Quant Trading & Python Backtesting Seminar',
    event_date: '2024-10-28T17:30:00Z',
    location: 'Science Center Hall B',
    source: 'Finance Society',
    category: 'Workshops',
    attendees_count: 58,
    tags: ['#Technical', '#Quant', '#Python'],
    notes: 'Building statistical arbitrage models and event-driven signals with pandas.',
    institution: 'ALL'
  }
];

export const INITIAL_SOURCES: SourceItem[] = [
  {
    id: 's1',
    course: 'FIN 301',
    week: 4,
    file_url: 'Slides 04 (FIN301) - Capital Structure & Valuation.pdf'
  },
  {
    id: 's2',
    course: 'FIN 301',
    week: 4,
    file_url: 'Berk & DeMarzo Ch. 15-16.pdf'
  },
  {
    id: 's3',
    course: 'FIN 301',
    week: 4,
    file_url: 'Prof. Vance Seminar Notes #14.pdf'
  },
  {
    id: 's4',
    course: 'ACC 210',
    week: 3,
    file_url: 'Cash Flow Modeling Template.xlsx'
  }
];

export const INITIAL_NOTES: NoteItem[] = [
  {
    id: 'n1',
    course: 'FIN 301',
    week: 4,
    content: JSON.stringify({
      title: 'Capital Structure & Valuation',
      title_en: 'Capital Structure & Valuation',
      docCode: 'DOC-CF-04.8',
      summary: 'Master synthesis balancing corporate tax shields, distress overhead, and Modigliani-Miller propositions.',
      summary_en: 'Master synthesis balancing corporate tax shields, distress overhead, and Modigliani-Miller propositions.',
      concepts: [
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
          formula: 're = rf + beta_L[E(Rm) - rf]',
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
          formula: 'CF0 = -(Capital Outlay + Flotation)',
          references: ['Slide 29']
        }
      ]
    })
  }
];

export const INITIAL_QUIZ: QuizItem = {
  id: 'q1',
  note_id: 'n1',
  score: 80,
  questions: [
    {
      id: 1,
      topic: 'Capital Structure Weights',
      topicTag: 'WEEK 2 ➔ WEEK 6 SYNERGY',
      categoryTag: 'M&M II + TAX',
      prompt: 'Apex Dynamics is evaluating recapitalizing by issuing $40M in debt at 6% to repurchase common shares. Assuming Modigliani-Miller Proposition II with corporate taxes (tc = 25%), how will the firm\'s cost of equity (re) and overall WACC be affected?',
      options: [
        {
          key: 'A',
          text: 'Both cost of equity (re) and WACC remain completely unchanged due to homemade leverage.'
        },
        {
          key: 'B',
          text: 'Cost of equity (re) decreases while WACC increases due to higher bankruptcy hazard.',
          badge: 'Incorrect Mechanism',
          note: 'Bankruptcy distress hazards are explicitly omitted in pure M&M Proposition II; cost of equity rises as financial risk increases, never decreases.'
        },
        {
          key: 'C',
          text: 'Cost of equity (re) increases linearly with D/E, while WACC declines due to the interest tax shield.',
          badge: 'Proposition II Validated',
          isCorrect: true
        },
        {
          key: 'D',
          text: 'Cost of equity increases exponentially while WACC falls to zero at maximum leverage.'
        }
      ],
      correctKey: 'C',
      selectedKey: 'B',
      explanationTitle: 'Why This Is Correct',
      explanationBody: 'Under Modigliani-Miller Proposition II with corporate taxes, interest payments on the newly issued $40M debt are sheltered at the 25% statutory rate. This shields cash flows from taxable income and reduces overall enterprise WACC. Concurrently, common shareholders assume additional leveraged variance, which inflates the required return on equity (re) in exact linear proportion to the debt-to-equity ratio (D/E).',
      formula1: 're = r0 + (r0 - rd)(1 - tc)(D/E)',
      formula1Subtitle: 'Linear slope dampened by (1 - 0.25)',
      formula2: 'PV(Tax Shield) = tc × D = $10.0M',
      formula2Subtitle: '25% × $40.0M added directly to V_L',
      syllabusReference: 'Week 4, Slide 12 (Capital Structure & WACC)',
      syllabusSection: 'SYLLABUS SEC. 4.3'
    },
    {
      id: 2,
      topic: 'WACC Discount Rates',
      topicTag: 'CAPITAL COSTS',
      categoryTag: 'WACC DERIVATION',
      prompt: 'When calculating after-tax WACC for a firm subject to statutory corporate tax tc, why is the debt cost multiplied by (1 - tc) while the cost of equity is left unadjusted?',
      options: [
        {
          key: 'A',
          text: 'Debt interest payments are tax-deductible expenses, creating a fiscal shelter, whereas equity dividend disbursements are paid from after-tax earnings.',
          isCorrect: true,
          badge: 'Tax Code Validated'
        },
        {
          key: 'B',
          text: 'Equity dividends are subsidized by federal tax credits.'
        },
        {
          key: 'C',
          text: 'Debt holders pay personal taxes on interest income at zero percent.'
        },
        {
          key: 'D',
          text: 'Both debt and equity undergo equal tax adjustments in secondary markets.'
        }
      ],
      correctKey: 'A',
      selectedKey: 'A',
      explanationTitle: 'Why This Is Correct',
      explanationBody: 'Interest paid on corporate debt is treated as an operating expense before taxable income is calculated. Dividends and capital gains distributions to equity holders are paid from net income (after corporate taxes), offering no direct corporate tax shelter.',
      formula1: 'rd(after-tax) = rd × (1 - tc)',
      formula1Subtitle: 'Direct deduction reduction',
      formula2: 'Tax Shield per period = tc × rd × D',
      formula2Subtitle: 'Annual corporate cash savings',
      syllabusReference: 'Week 4, Slide 6 (Debt Tax Deductibility)',
      syllabusSection: 'SYLLABUS SEC. 4.1'
    },
    {
      id: 3,
      topic: 'Modigliani-Miller Proposition II with Corporate Taxes',
      topicTag: 'LEVERAGE MECHANICS',
      categoryTag: 'M&M THEOREM',
      prompt: 'According to M&M Proposition I with corporate taxes, what is the enterprise value of a levered firm (V_L) relative to an identical unlevered firm (V_U)?',
      options: [
        {
          key: 'A',
          text: 'V_L is strictly equal to V_U regardless of tax brackets.'
        },
        {
          key: 'B',
          text: 'V_L = V_U + tc × D, where tc × D is the present value of the perpetual interest tax shield.',
          isCorrect: true,
          badge: 'M&M I Tax Formulation'
        },
        {
          key: 'C',
          text: 'V_L is reduced by the present value of bankruptcy costs at all debt levels.'
        },
        {
          key: 'D',
          text: 'V_L = V_U - tc × D due to agency distress fees.'
        }
      ],
      correctKey: 'B',
      selectedKey: 'B',
      explanationTitle: 'Why This Is Correct',
      explanationBody: 'Because interest payments are tax-deductible, issuing debt permanently lowers the government\'s tax slice of operating profits. For perpetual debt, the present value of this shield is tc × D, directly augmenting firm value.',
      formula1: 'V_L = V_U + tc × D',
      formula1Subtitle: 'Perpetual cash flow discounting',
      formula2: 'Value Added = tc × D',
      formula2Subtitle: 'Pure tax shelter wealth gain',
      syllabusReference: 'Week 4, Slide 10 (Levered Enterprise Valuation)',
      syllabusSection: 'SYLLABUS SEC. 4.2'
    },
    {
      id: 4,
      topic: 'Interest Tax Shields',
      topicTag: 'VALUATION TECHNIQUES',
      categoryTag: 'APV & DCF',
      prompt: 'If a project is financed with a specific debt schedule that fluctuates over time rather than maintaining a constant debt-to-equity ratio, which valuation method is most theoretically robust?',
      options: [
        {
          key: 'A',
          text: 'WACC approach, as WACC remains constant even when debt levels shift.'
        },
        {
          key: 'B',
          text: 'Adjusted Present Value (APV), because it discounts the unlevered cash flows and debt tax shields separately.',
          isCorrect: true,
          badge: 'APV Selected'
        },
        {
          key: 'C',
          text: 'Dividend Discount Model (DDM) with constant growth.'
        },
        {
          key: 'D',
          text: 'Internal Rate of Return without reinvestment rate matching.'
        }
      ],
      correctKey: 'B',
      selectedKey: 'B',
      explanationTitle: 'Why This Is Correct',
      explanationBody: 'When debt dollars are predetermined or changing irregularly, the D/E ratio fluctuates, making WACC vary each period. APV evaluates the base case cash flows at unlevered cost of capital and models interest tax shields explicitly.',
      formula1: 'APV = NPV(Unlevered) + PV(Financing Side Effects)',
      formula1Subtitle: 'Decoupled valuation framework',
      formula2: 'PV(Tax Shield) = Sum [ tc × rd × D_t / (1 + rd)^t ]',
      formula2Subtitle: 'Period-by-period discounting at rd',
      syllabusReference: 'Week 4, Slide 15 (APV vs WACC)',
      syllabusSection: 'SYLLABUS SEC. 4.4'
    },
    {
      id: 5,
      topic: 'Debt vs Equity Signaling',
      topicTag: 'INFORMATION ASYMMETRY',
      categoryTag: 'PECKING ORDER',
      prompt: 'According to Myers and Majluf\'s Pecking Order Theory under asymmetric information, why do firms prefer internal financing and debt over issuing new equity?',
      options: [
        {
          key: 'A',
          text: 'New equity issuance signals to the market that management believes the stock is overvalued, leading to an immediate negative price discount.',
          isCorrect: true,
          badge: 'Adverse Selection Proof'
        },
        {
          key: 'B',
          text: 'Debt issuances require shareholder voting approval in all public filings.'
        },
        {
          key: 'C',
          text: 'Internal retained earnings trigger punitive corporate tax withholding.'
        },
        {
          key: 'D',
          text: 'Underwriters charge zero fees for debt placements compared to equity.'
        }
      ],
      correctKey: 'A',
      selectedKey: 'A',
      explanationTitle: 'Why This Is Correct',
      explanationBody: 'Because managers possess superior private information about true asset value, issuing equity exposes current owners to dilution risk if shares are undervalued. Consequently, investors rationally interpret equity announcements as overvaluation signals, depressing share prices.',
      formula1: 'Hierarchy: Retained Earnings > Debt > Hybrid > Equity',
      formula1Subtitle: 'Information cost minimization',
      formula2: 'Price Drop = Adverse Selection Penalty',
      formula2Subtitle: 'Empirically ~2-3% drop upon equity announcement',
      syllabusReference: 'Week 4, Slide 20 (Pecking Order Theory)',
      syllabusSection: 'SYLLABUS SEC. 4.5'
    }
  ]
};
