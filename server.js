require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const modelName = "gemini-2.0-flash-lite";

// ─── UTILS ─────────────────────────────────────────────────────────────
function extractJson(rawText) {
  return rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
}

// ─── ENDPOINT 1: ADAPTIVE QUESTIONS ────────────────────────────────────
app.post("/api/adaptive-questions", async (req, res) => {
  const { q1, q2, q3 } = req.body.answers || {};

  if (!q1 || !q2 || !q3) {
    return res.status(400).json({ error: "Missing Phase 1 answers" });
  }

  const systemPrompt = `You are an expert Indian college and career counsellor. Based on a Class 12 student's initial responses, generate exactly 5 deeply personalized follow-up questions that dig into what matters most for THIS specific student. Questions should feel like a real counsellor asking — conversational, specific, not generic. Return ONLY a JSON array of 5 strings, no other text.`;

  const userPrompt = `
Student answered:
Stream/subjects they study: ${q1}
What they enjoy outside school: ${q2}
Their vague career thought or confusion: ${q3}

Generate 5 follow-up questions that will help uncover their ideal college and career path. Make questions specific to what they said. For example, if they mentioned liking biology but also art, ask about that specific tension. If they mentioned a specific career, ask what they actually know about it.

Return format:
{
  "questions": [
    "Question 1...",
    "Question 2...",
    "Question 3...",
    "Question 4...",
    "Question 5..."
  ]
}
`;

  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: systemPrompt + "\n\n" + userPrompt }] }]
    });
    const parsed = JSON.parse(extractJson(result.response.text()));
    console.log("✅ Adaptive questions generated dynamically.");
    return res.json(parsed);
  } catch (error) {
    console.warn("⚠️ AI unavailable for questions, using fallback. Reason:", error.message?.split("\n")[0]);
    // Fallback questions if quota hit
    return res.json({
      questions: [
        "What specific aspects of your current subjects do you actually enjoy?",
        "Describe your ideal work environment. Do you prefer working solo, in teams, outdoors, or in a structured office?",
        "How much does earning potential matter to you compared to pursuing a passion?",
        "Are there any specific colleges or cities you already have in mind for your studies?",
        "What is your biggest fear or constraint when thinking about life after 12th?"
      ]
    });
  }
});

// ─── ENDPOINT 2: GENERATE REPORT ───────────────────────────────────────

// Very comprehensive fallback if Gemini rate-limits again (as happened before)
function generateFallbackReport(phase1) {
  const q1 = phase1.q1.toLowerCase();
  const q2 = phase1.q2.toLowerCase();
  const q3 = phase1.q3.toLowerCase();
  
  const isMed = q1.includes("pcb") || q1.includes("bio") || q3.includes("doctor");
  const isComm = q1.includes("comm") || q1.includes("account") || q3.includes("ca");
  const isArts = q1.includes("art") || q1.includes("humanities") || q1.includes("law");

  if (isMed) {
    return {
      profile_summary: "You are a student who wants to make a tangible impact, grounded in science but driven by human outcomes. Your interest in biology points towards the medical sciences, though you might be exploring alternatives to the traditional MBBS route.",
      key_insight: "You might be conflating the desire to help people with the requirement to become a doctor. The healthcare industry is vast and needs analytical minds everywhere.",
      strengths: ["Strong foundation in life sciences", "Empathy and care-driven orientation", "Willingness to commit to long-term study", "Analytical mindset combined with observation"],
      gaps: ["May have tunnel vision towards NEET", "Potential burnout from competitive pressure", "Need to widen scope of understanding allied health options"],
      careers: [
        { title: "MBBS Specialist", why_it_fits: "The clearest path if you want direct patient care and high clinical impact.", entrance_exams: ["NEET UG"], earning_range: "₹8–25 LPA", reality_check: "It takes 10+ years of intense study to become a high-earning specialist." },
        { title: "Biomedical Engineer", why_it_fits: "Bridges your interest in science with the massive healthcare tech boom in India.", entrance_exams: ["JEE Main", "VITEEE", "BITSAT"], earning_range: "₹6–18 LPA", reality_check: "Requires strong math and physics, not just biology." },
        { title: "Clinical Psychologist", why_it_fits: "Allows you to heal and help people without the surgical/medical route.", entrance_exams: ["CUET", "University specifics"], earning_range: "₹5–15 LPA", reality_check: "Requires a Master's degree and RCI licensing to practice legally." }
      ],
      colleges: [
        { name: "AIIMS New Delhi", city: "New Delhi", type: "Government", course_to_target: "MBBS", entrance_exam: "NEET", why_this_fits_student: "The absolute pinnacle of medical education in India.", difficulty: "Reach" },
        { name: "Christian Medical College (CMC)", city: "Vellore", type: "Private", course_to_target: "MBBS", entrance_exam: "NEET", why_this_fits_student: "Exceptional clinical exposure and values-driven education.", difficulty: "Reach" },
        { name: "Kasturba Medical College", city: "Manipal", type: "Deemed", course_to_target: "MBBS", entrance_exam: "NEET", why_this_fits_student: "Top private institution with great infrastructure.", difficulty: "Target" },
        { name: "TISS Mumbai", city: "Mumbai", type: "Government", course_to_target: "BA Psychology", entrance_exam: "CUET", why_this_fits_student: "If you pivot towards mental health and social sciences.", difficulty: "Target" },
        { name: "VIT Vellore", city: "Vellore", type: "Deemed", course_to_target: "B.Tech Biomedical", entrance_exam: "VITEEE", why_this_fits_student: "Excellent facilities blending technology and health.", difficulty: "Safe" },
        { name: "Symbiosis Institute of Health Sciences", city: "Pune", type: "Private", course_to_target: "B.Sc Medical Technology", entrance_exam: "SET", why_this_fits_student: "Great for allied health sciences.", difficulty: "Safe" },
        { name: "Armed Forces Medical College (AFMC)", city: "Pune", type: "Government", course_to_target: "MBBS", entrance_exam: "NEET + Interview", why_this_fits_student: "Discipline and guaranteed medical career serving the nation.", difficulty: "Reach" },
        { name: "St. Xavier's College", city: "Mumbai", type: "Autonomous", course_to_target: "B.Sc Life Sciences", entrance_exam: "Merit / CUET", why_this_fits_student: "Strong foundation for research.", difficulty: "Target" }
      ],
      emerging_roles: [
        { title: "Health Informatics Specialist", description: "Managing and analysing massive amounts of hospital data to improve patient outcomes.", why_relevant: "Combines healthcare knowledge with tech, avoiding clinical stress." },
        { title: "Genetic Counsellor", description: "Advising families on genetic risks using DNA sequencing data.", why_relevant: "A rapidly growing niche as personalized medicine expands." }
      ],
      next_30_days: [
        "Take a mock NEET test this weekend to establish a brutally honest baseline score.",
        "Research the syllabus for B.Sc Psychology and B.Tech Biomedical to see if they excite you.",
        "Identify 3 private colleges you would actually be happy attending as backups.",
        "Talk to someone who is currently in their 3rd year of MBBS.",
        "Cut out one major distraction (like an app) for the next 3 weeks to focus."
      ]
    };
  } else if (isComm || isArts) {
    return {
      profile_summary: "You are drawing from a foundation in commerce or humanities, meaning you likely excel at systems, communication, or human behaviors. You're looking for a path that balances financial stability with work that doesn't feel like a mindless grind.",
      key_insight: "You underestimate how much of the modern business/tech world relies on narrative and human psychology, not just spreadsheets.",
      strengths: ["Strong communication potential", "Understanding of societal/business frameworks", "Flexibility to pivot across multiple industries", "Analytical thinking outside of pure math"],
      gaps: ["May lack hard technical skills (coding/data)", "Vulnerable to generic degree traps (BA/BCom with no specialization)", "Potential confusion given the sheer volume of options"],
      careers: [
        { title: "Management Consultant", why_it_fits: "Leverages your ability to quickly understand business problems and communicate solutions.", entrance_exams: ["CAT (Post-grad)", "IPMAT (Undergrad)"], earning_range: "₹12–40 LPA", reality_check: "Extremely high stress, immense travel, and intense competition." },
        { title: "Corporate / Tech Lawyer", why_it_fits: "Indian law is evolving rapidly around tech, IP, and startups; highly lucrative.", entrance_exams: ["CLAT", "LSAT India"], earning_range: "₹8–30 LPA", reality_check: "The first 3 years are a grueling grind of paperwork." },
        { title: "UX/UI Designer", why_it_fits: "Marries your understanding of human psychology with the booming tech sector.", entrance_exams: ["NID DAT", "UCEED"], earning_range: "₹6–25 LPA", reality_check: "You must constantly keep up with rapidly changing design tools." }
      ],
      colleges: [
        { name: "National Law School of India University (NLSIU)", city: "Bangalore", type: "Government", course_to_target: "BA LLB", entrance_exam: "CLAT", why_this_fits_student: "The undeniable peak of legal education in India.", difficulty: "Reach" },
        { name: "IIM Indore", city: "Indore", type: "Government", course_to_target: "IPM (Integrated BBA+MBA)", entrance_exam: "IPMAT", why_this_fits_student: "Direct entry into an IIM right after 12th.", difficulty: "Reach" },
        { name: "Shri Ram College of Commerce (SRCC)", city: "New Delhi", type: "Government", course_to_target: "B.Com (Hons)", entrance_exam: "CUET", why_this_fits_student: "The premier commerce college in India with unmatched alumni.", difficulty: "Reach" },
        { name: "Ashoka University", city: "Sonipat", type: "Private", course_to_target: "BA Economics / Psychology", entrance_exam: "AAT", why_this_fits_student: "The best liberal arts education, encouraging diverse subjects.", difficulty: "Target" },
        { name: "Narsee Monjee Institute of Management (NMIMS)", city: "Mumbai", type: "Deemed", course_to_target: "BBA", entrance_exam: "NPAT", why_this_fits_student: "Strong corporate connections in India's financial capital.", difficulty: "Target" },
        { name: "Christ University", city: "Bangalore", type: "Private", course_to_target: "BBA / BA", entrance_exam: "CUET (Christ)", why_this_fits_student: "Disciplined environment with excellent industry exposure.", difficulty: "Safe" },
        { name: "Symbiosis Law School", city: "Pune", type: "Private", course_to_target: "BA LLB", entrance_exam: "SLAT", why_this_fits_student: "A very strong private alternative for corporate law.", difficulty: "Target" },
        { name: "National Institute of Design (NID)", city: "Ahmedabad", type: "Government", course_to_target: "B.Des", entrance_exam: "NID DAT", why_this_fits_student: "If you pivot towards the creative/design aspects of business.", difficulty: "Reach" }
      ],
      emerging_roles: [
        { title: "ESG Analyst", description: "Evaluating companies on Environmental, Social, and Governance metrics.", why_relevant: "Every major fund in India is hiring for this; requires business and social understanding." },
        { title: "Prompt Strategist / AI Content Editor", description: "Structuring workflows for businesses using AI tools.", why_relevant: "Leverages strong communication and critical thinking skills without needing to code." }
      ],
      next_30_days: [
        "Take a sample CLAT paper and a sample IPMAT paper this week.",
        "Look up the syllabus for Ashoka University's Liberal Arts program.",
        "Start reading the business section of The Hindu or Mint every morning.",
        "Watch a 'Day in the Life' video for a Management Consultant.",
        "Shortlist 3 backup colleges that do not require an intense entrance exam."
      ]
    };
  } else {
    // Default / Tech
    return {
      profile_summary: "You have a solid technical/PCM foundation. You are looking at engineering or science, but you might be feeling overwhelmed by the sheer competitiveness of the JEE rat race. You want a career that is logical, scalable, and highly rewarding.",
      key_insight: "You likely assume that 'Computer Science at an IIT' is the only marker of success, blinding you to massive opportunities in data, design, and product at other great institutions.",
      strengths: ["Strong quantitative and logical reasoning", "Comfortable with technical concepts", "High agency and problem-solving mindset", "Clear understanding of the tech-driven future"],
      gaps: ["May be neglecting soft skills and communication", "Over-indexing solely on JEE Mains/Advanced", "Lack of clarity around non-SDE tech roles (like Product)"],
      careers: [
        { title: "Software Development Engineer (SDE)", why_it_fits: "The most direct path for logical thinkers to build high-scale impact.", entrance_exams: ["JEE Main", "JEE Advanced"], earning_range: "₹9–45 LPA", reality_check: "The market is saturated at the entry level; you must be exceptionally good to stand out." },
        { title: "Data Scientist / ML Engineer", why_it_fits: "Moves beyond coding into math and statistics, which aligns with PCM strengths.", entrance_exams: ["JEE Main", "BITS"], earning_range: "₹10–40 LPA", reality_check: "Requires continuous learning; the math is significantly harder than the coding." },
        { title: "Product Manager", why_it_fits: "Sits between business, design, and engineering. Perfect if you like tech but also people.", entrance_exams: ["Various B.Tech", "IPMAT"], earning_range: "₹15–50 LPA", reality_check: "You have all the responsibility for the product but none of the actual authority." }
      ],
      colleges: [
        { name: "IIT Bombay", city: "Mumbai", type: "Government", course_to_target: "B.Tech CSE/ECE", entrance_exam: "JEE Advanced", why_this_fits_student: "Unmatched ecosystem for tech and startups in India.", difficulty: "Reach" },
        { name: "BITS Pilani", city: "Pilani", type: "Private", course_to_target: "B.Tech CSE", entrance_exam: "BITSAT", why_this_fits_student: "No-reservation meritocracy with a massive founder network.", difficulty: "Reach" },
        { name: "IIIT Hyderabad", city: "Hyderabad", type: "Government/PPP", course_to_target: "B.Tech CSE / AI", entrance_exam: "JEE Main / UGEE", why_this_fits_student: "Arguably the best coding culture in the country.", difficulty: "Reach" },
        { name: "NIT Trichy", city: "Trichy", type: "Government", course_to_target: "B.Tech", entrance_exam: "JEE Main", why_this_fits_student: "Top NIT with exceptional placements.", difficulty: "Target" },
        { name: "Delhi Technological University (DTU)", city: "New Delhi", type: "Government", course_to_target: "B.Tech CSE", entrance_exam: "JEE Main / JAC", why_this_fits_student: "Massive tech hiring ground in the NCR region.", difficulty: "Target" },
        { name: "VIT Vellore", city: "Vellore", type: "Private", course_to_target: "B.Tech CSE", entrance_exam: "VITEEE", why_this_fits_student: "Massive campus with excellent placement opportunities if you maintain your CGPA.", difficulty: "Safe" },
        { name: "Manipal Institute of Technology", city: "Manipal", type: "Private", course_to_target: "B.Tech CSE / IT", entrance_exam: "MET", why_this_fits_student: "Great all-round development and strong alumni network.", difficulty: "Safe" },
        { name: "Plaksha University", city: "Mohali", type: "Private", course_to_target: "B.Tech in Tech & Design", entrance_exam: "TechAT", why_this_fits_student: "A new-age tech university built by top founders to reimagine engineering.", difficulty: "Target" }
      ],
      emerging_roles: [
        { title: "DevSecOps Engineer", description: "Integrating security directly into the software development process.", why_relevant: "Cybersecurity is exploding in India; this blends coding with infrastructure." },
        { title: "Quantum Computing Researcher", description: "Working with the next generation of computing paradigms.", why_relevant: "Highly mathematical and physics-driven, moving from academic labs to corporate." }
      ],
      next_30_days: [
        "Take a full JEE Main mock test to aggressively identify your weak areas.",
        "Spend 2 hours building a simple portfolio website using HTML/CSS.",
        "Look into the syllabus and format for the BITSAT exam.",
        "Identify 2 'Safe' colleges and note their separate application deadlines.",
        "Talk to a current first or second-year engineering student on LinkedIn."
      ]
    };
  }
}

app.post("/api/generate-report", async (req, res) => {
  const { phase1, phase2 } = req.body;

  if (!phase1 || !phase2) {
    return res.status(400).json({ error: "Missing phase answers." });
  }

  const systemPrompt = `You are India's most experienced college counsellor with 25 years of practice. You have complete knowledge of every college in India: all 23 IITs, all 31 NITs, all 20 IIMs, AIIMS and all medical colleges, all 22 NLUs for law, all IIITs, central universities (DU, JNU, BHU, HCU, JMI etc), state universities, top private universities (Ashoka, Manipal, Amity, SRM, VIT, Symbiosis, Christ, Flame, Krea, Shiv Nadar, OP Jindal etc), design institutes (NID Ahmedabad, all NIDs, NIFT campuses, MIT Institute of Design), hotel management (IHM Delhi, IHM Mumbai etc), mass comm and journalism institutes, sports universities, agriculture universities, and emerging new-age colleges. You give brutally honest, accurate, specific advice — not generic. You know entrance exams: JEE Main, JEE Advanced, NEET, CLAT, CUET, IPMAT, UCEED, CEED, NID DAT, NIFT entrance, CAT, hotel management entrance (NCHM JEE), and state-level exams. You NEVER recommend a college that does not exist.`;

  let promptAnswers = `Here is everything a Class 12 student shared:\n\nPHASE 1:\n`;
  promptAnswers += `Stream and subjects: ${phase1.q1}\n`;
  promptAnswers += `What they enjoy outside school: ${phase1.q2}\n`;
  promptAnswers += `Career thoughts: ${phase1.q3}\n\nPHASE 2 (adaptive follow-up answers):\n`;
  
  for (const [q, a] of Object.entries(phase2)) {
    promptAnswers += `Q: ${q}\nA: ${a}\n\n`;
  }

  const userPrompt = `${promptAnswers}
Now generate their PathReport as strict JSON with this exact structure:
{
  "profile_summary": "string (4-5 lines, reads like a counsellor who truly understood them)",
  "key_insight": "string (1 powerful observation most people miss about this student)",
  "strengths": ["string", "string", "string", "string"],
  "gaps": ["string", "string", "string"],
  "careers": [
    {
      "title": "...",
      "why_it_fits": "...",
      "entrance_exams": ["...", "..."],
      "earning_range": "₹... LPA",
      "reality_check": "..."
    }
  ],
  "colleges": [
    {
      "name": "...",
      "city": "...",
      "type": "...",
      "course_to_target": "...",
      "entrance_exam": "...",
      "why_this_fits_student": "...",
      "difficulty": "Reach|Target|Safe"
    }
  ],
  "emerging_roles": [
    {
      "title": "...",
      "description": "...",
      "why_relevant": "..."
    }
  ],
  "next_30_days": ["...", "...", "...", "...", "..."]
}
Return ONLY the JSON object, no markdown, no explanation. Output 8 colleges and exactly 3 careers.`;

  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: systemPrompt + "\n\n" + userPrompt }] }]
    });
    
    const parsed = JSON.parse(extractJson(result.response.text()));
    console.log("✅ Final PathReport generated dynamically.");
    return res.json(parsed);
  } catch (error) {
    console.warn("⚠️ AI unavailable for report, using robust fallback. Reason:", error.message?.split("\n")[0]);
    return res.json(generateFallbackReport(phase1));
  }
});

// ─── ENDPOINT 3: CONTEXTUAL CHATBOT ────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { message, pathreport, history } = req.body;

  if (!message || !pathreport || !history) {
    return res.status(400).json({ error: "Missing required chat parameters." });
  }

  const systemPrompt = `You are a personal career counsellor for an Indian Class 12 student. You already generated their PathReport which is provided below. You know everything about them. When they ask questions, answer specifically based on their profile — never give generic advice. If they share new information about themselves, tell them exactly how it changes their career or college recommendations and be specific (name actual colleges, actual exams). Keep responses concise — 3-5 lines max unless they ask for detail. Sound like a knowledgeable senior who genuinely cares, not a chatbot.

STUDENT'S PATHREPORT:
${JSON.stringify(pathreport, null, 2)}`;

  // Convert history array to Gemini's format: { role: 'user'|'model', parts: [{text: '...'}] }
  const formattedHistory = history.map(msg => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }]
  }));

  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: systemPrompt + "\\n\\nThe user will now start chatting with you." }]} ,
        { role: "model", parts: [{ text: "Understood. I am ready to act as the passionate, knowledgeable counsellor." }]},
        ...formattedHistory
      ]
    });

    const result = await chat.sendMessage([{ text: message }]);
    console.log("✅ Chat response generated dynamically.");
    return res.json({ reply: result.response.text().trim() });
  } catch (error) {
    console.warn("⚠️ AI unavailable for chat, using fallback. Reason:", error.message?.split("\\n")[0]);
    // Fallback if API fails
    return res.json({ 
      reply: "It looks like my AI core is currently hitting a rate limit. However, based on your report, I recommend you look closely at the 'Next 30 Days' action items, specifically focusing on your target exams and colleges." 
    });
  }
});

app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`✅ PathRight V2 server running on http://localhost:${PORT}`);
});
