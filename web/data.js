var WIKI_DATA = {
  "pages": [
    {
      "slug": "src-attention-is-all-you-need",
      "title": "Attention Is All You Need",
      "category": "sources",
      "content": "## Attention Is All You Need\n\n**Tesi**: il meccanismo di [[attention-mechanism]] è sufficiente a costruire modelli di sequenza potenti, eliminando la necessità di reti ricorrenti o convolutive.\n\n## Punti Chiave\n- Propone l'architettura [[transformer]] basata interamente su self-attention\n- Multi-head attention permette al modello di focalizzarsi su posizioni diverse contemporaneamente\n- Positional encoding sostituisce la sequenzialità delle RNN\n- Parallelizzabile: training molto più veloce delle LSTM\n\n## Impatto\nOgni modello LLM moderno — [[gpt-4]], [[claude]], [[gemini]] — è basato su questa architettura.\n\n## Correlate\n- [[transformer]]\n- [[attention-mechanism]]\n- [[google-deepmind]]",
      "frontmatter": {"created": "2026-01-10", "updated": "2026-03-15", "tags": ["paper", "transformer", "attention"], "sources": []},
      "links": ["attention-mechanism", "transformer", "gpt-4", "claude", "gemini", "google-deepmind"],
      "backlinks": ["transformer", "attention-mechanism", "gpt-4-vs-claude"]
    },
    {
      "slug": "src-scaling-laws",
      "title": "Scaling Laws for Neural Language Models",
      "category": "sources",
      "content": "## Scaling Laws for Neural Language Models\n\n**Tesi**: la performance dei modelli linguistici scala in modo prevedibile con compute, dati e parametri — la legge Chinchilla ottimale è 20 token per parametro.\n\n## Punti Chiave\n- Performance ∝ N^0.076 (parametri), D^0.095 (dati), C^0.050 (compute)\n- Modelli troppo grandi sono sotto-addestrati: GPT-3 era 4× sotto-addestrato\n- Chinchilla (70B, 1.4T token) supera Gopher (280B, 300B token) con 4× meno compute\n- Implicazione pratica: scalare dati è spesso più efficiente di scalare parametri\n\n## Correlate\n- [[transformer]]\n- [[google-deepmind]]\n- [[fine-tuning]]",
      "frontmatter": {"created": "2026-01-12", "updated": "2026-02-20", "tags": ["paper", "scaling", "chinchilla"]},
      "links": ["transformer", "google-deepmind", "fine-tuning"],
      "backlinks": ["transformer", "google-deepmind"]
    },
    {
      "slug": "src-karpathy-llm-wiki",
      "title": "Karpathy LLM Wiki Method",
      "category": "sources",
      "content": "## Karpathy LLM Wiki Method\n\n**Tesi**: usare un LLM come compilatore incrementale di una knowledge base strutturata è più efficace di qualsiasi sistema RAG con embedding.\n\n## Punti Chiave\n- L'LLM legge direttamente i file markdown — nessun vector DB\n- Le pagine vengono **riscritte** (distillate), non accumulate\n- Struttura: `sources/`, `entities/`, `concepts/`, `comparisons/`\n- Il grafo 3D con wikilinks rende visibile la struttura della conoscenza\n- Portabile: funziona su USB, qualsiasi PC, senza server\n\n## Correlate\n- [[andrej-karpathy]]\n- [[llm-wiki-method]]\n- [[rag-vs-fine-tuning]]",
      "frontmatter": {"created": "2026-01-05", "updated": "2026-04-01", "tags": ["method", "knowledge-base", "karpathy"]},
      "links": ["andrej-karpathy", "llm-wiki-method", "rag-vs-fine-tuning"],
      "backlinks": ["llm-wiki-method", "andrej-karpathy"]
    },
    {
      "slug": "src-rlhf-paper",
      "title": "InstructGPT — Training Language Models to Follow Instructions",
      "category": "sources",
      "content": "## InstructGPT\n\n**Tesi**: il [[reinforcement-learning-from-human-feedback]] (RLHF) allinea i modelli alle intenzioni umane molto più efficacemente del semplice fine-tuning supervisionato.\n\n## Punti Chiave\n- SFT (supervised fine-tuning) su prompt selezionati\n- Reward model addestrato su preferenze umane\n- PPO per ottimizzare il policy model verso il reward model\n- Un modello 1.3B RLHF supera GPT-3 175B su molte task\n\n## Correlate\n- [[reinforcement-learning-from-human-feedback]]\n- [[openai]]\n- [[fine-tuning]]",
      "frontmatter": {"created": "2026-01-18", "updated": "2026-03-01", "tags": ["paper", "rlhf", "alignment"]},
      "links": ["reinforcement-learning-from-human-feedback", "openai", "fine-tuning"],
      "backlinks": ["reinforcement-learning-from-human-feedback", "openai"]
    },
    {
      "slug": "openai",
      "title": "OpenAI",
      "category": "entities",
      "content": "## OpenAI\n\nLab AI fondato nel 2015, creatore di [[gpt-4]] e della serie GPT. Ha pionierizzato [[reinforcement-learning-from-human-feedback]] con [[src-rlhf-paper]].\n\n## Prodotti Chiave\n- GPT-4 / GPT-4o — modello flagship multimodale\n- o1, o3 — modelli con chain-of-thought esplicito\n- DALL-E, Sora — generazione immagini/video\n- ChatGPT — interfaccia consumer\n\n## Posizione\nLeader di mercato in LLM consumer; principale competitor è [[anthropic]] per modelli enterprise.\n\n## Correlate\n- [[gpt-4-vs-claude]]\n- [[reinforcement-learning-from-human-feedback]]\n- [[fine-tuning]]",
      "frontmatter": {"created": "2026-01-08", "updated": "2026-04-10", "tags": ["company", "ai-lab", "usa"]},
      "links": ["gpt-4-vs-claude", "reinforcement-learning-from-human-feedback", "fine-tuning", "anthropic"],
      "backlinks": ["src-rlhf-paper", "gpt-4-vs-claude", "anthropic"]
    },
    {
      "slug": "anthropic",
      "title": "Anthropic",
      "category": "entities",
      "content": "## Anthropic\n\nLab AI fondato nel 2021 da ex-OpenAI, creatore della famiglia [[claude]]. Focus su AI safety e interpretabilità.\n\n## Prodotti Chiave\n- Claude 3.5 / 4.x — modelli flagship con 200K context\n- Constitutional AI — alternativa ad RLHF basata su principi\n- Model Card rigorose\n\n## Posizione\nForte in enterprise e coding; contende con [[openai]] per developer mindshare.\n\n## Correlate\n- [[gpt-4-vs-claude]]\n- [[context-window]]\n- [[openai]]",
      "frontmatter": {"created": "2026-01-09", "updated": "2026-04-12", "tags": ["company", "ai-lab", "safety"]},
      "links": ["gpt-4-vs-claude", "context-window", "openai"],
      "backlinks": ["gpt-4-vs-claude", "openai"]
    },
    {
      "slug": "google-deepmind",
      "title": "Google DeepMind",
      "category": "entities",
      "content": "## Google DeepMind\n\nMerge di Google Brain e DeepMind (2023). Autori di [[src-attention-is-all-you-need]] e [[src-scaling-laws]] (Chinchilla). Creatori di Gemini.\n\n## Contributi Fondamentali\n- Transformer (2017) — base di tutti i moderni LLM\n- Chinchilla scaling laws — ottimizzazione compute/dati\n- Gemini 1.5 Pro — 1M context window\n- AlphaFold — protein structure prediction\n\n## Correlate\n- [[src-attention-is-all-you-need]]\n- [[src-scaling-laws]]\n- [[transformer]]",
      "frontmatter": {"created": "2026-01-10", "updated": "2026-03-20", "tags": ["company", "research", "google"]},
      "links": ["src-attention-is-all-you-need", "src-scaling-laws", "transformer"],
      "backlinks": ["src-attention-is-all-you-need", "src-scaling-laws", "transformer"]
    },
    {
      "slug": "andrej-karpathy",
      "title": "Andrej Karpathy",
      "category": "entities",
      "content": "## Andrej Karpathy\n\nRicercatore AI, ex-direttore AI di Tesla, ex-OpenAI. Autore del metodo [[llm-wiki-method]] e di risorse educative fondamentali su LLM.\n\n## Contributi\n- LLM Wiki method — knowledge base portabile con LLM come compilatore\n- nanoGPT — implementazione GPT minimale\n- makemore, micrograd — didattica reti neurali\n- \"The spelled-out intro to neural networks\" (YouTube)\n\n## Correlate\n- [[src-karpathy-llm-wiki]]\n- [[llm-wiki-method]]\n- [[transformer]]",
      "frontmatter": {"created": "2026-01-06", "updated": "2026-04-05", "tags": ["person", "researcher", "educator"]},
      "links": ["src-karpathy-llm-wiki", "llm-wiki-method", "transformer"],
      "backlinks": ["src-karpathy-llm-wiki", "llm-wiki-method"]
    },
    {
      "slug": "transformer",
      "title": "Transformer Architecture",
      "category": "concepts",
      "content": "## Transformer Architecture\n\n**Tesi**: l'architettura Transformer basata su self-attention è la base universale di tutti i moderni LLM, superiore a RNN e CNN per sequenze.\n\n## Componenti Core\n- **Self-attention**: ogni token attende a tutti gli altri\n- **Multi-head attention**: attenzione parallela su sottospazi diversi\n- **Feed-forward layers**: trasformazione non-lineare per posizione\n- **Positional encoding**: iniezione dell'ordine sequenziale\n- **Layer normalization** + residual connections: stabilità training\n\n## Varianti\n- Encoder-only (BERT) — comprensione\n- Decoder-only (GPT) — generazione\n- Encoder-decoder (T5) — traduzione/riassunto\n\n## Correlate\n- [[src-attention-is-all-you-need]]\n- [[attention-mechanism]]\n- [[context-window]]\n- [[tokenization]]",
      "frontmatter": {"created": "2026-01-11", "updated": "2026-04-08", "tags": ["architecture", "deep-learning", "foundational"]},
      "links": ["src-attention-is-all-you-need", "attention-mechanism", "context-window", "tokenization"],
      "backlinks": ["src-attention-is-all-you-need", "src-scaling-laws", "attention-mechanism", "andrej-karpathy", "google-deepmind", "chain-of-thought"]
    },
    {
      "slug": "attention-mechanism",
      "title": "Attention Mechanism",
      "category": "concepts",
      "content": "## Attention Mechanism\n\n**Tesi**: il meccanismo di attenzione permette al modello di pesare dinamicamente le relazioni tra tutti i token, superando il bottleneck del contesto fisso nelle RNN.\n\n## Come Funziona\n- Query (Q), Key (K), Value (V) — ogni token produce tre vettori\n- Score = softmax(QK^T / √d_k) — similarità coseno scalata\n- Output = score × V — somma pesata dei valori\n- **Multi-head**: h teste parallele su sottospazi diversi, concatenate\n\n## Self-Attention vs Cross-Attention\n- Self: Q, K, V dalla stessa sequenza (comprensione interna)\n- Cross: Q dall'output, K/V dall'input (decoder-encoder bridge)\n\n## Correlate\n- [[transformer]]\n- [[src-attention-is-all-you-need]]\n- [[context-window]]",
      "frontmatter": {"created": "2026-01-12", "updated": "2026-03-25", "tags": ["mechanism", "deep-learning", "core"]},
      "links": ["transformer", "src-attention-is-all-you-need", "context-window"],
      "backlinks": ["transformer", "src-attention-is-all-you-need", "chain-of-thought"]
    },
    {
      "slug": "reinforcement-learning-from-human-feedback",
      "title": "Reinforcement Learning from Human Feedback",
      "category": "concepts",
      "content": "## Reinforcement Learning from Human Feedback (RLHF)\n\n**Tesi**: RLHF è il metodo dominante per allineare LLM alle preferenze umane — un modello 1.3B con RLHF supera GPT-3 175B su molte task di istruzione.\n\n## Pipeline\n1. **SFT**: supervised fine-tuning su risposte di alta qualità\n2. **Reward model**: addestrato su coppie di preferenze umane (A > B)\n3. **PPO**: ottimizza il policy model verso il reward model\n\n## Limitazioni\n- Costoso: richiede annotatori umani\n- Reward hacking: il modello impara a massimizzare il reward senza essere utile\n- Alternativa: Constitutional AI ([[anthropic]]) usa principi invece di preferenze\n\n## Correlate\n- [[src-rlhf-paper]]\n- [[openai]]\n- [[fine-tuning]]",
      "frontmatter": {"created": "2026-01-19", "updated": "2026-03-10", "tags": ["alignment", "training", "rlhf"]},
      "links": ["src-rlhf-paper", "openai", "fine-tuning", "anthropic"],
      "backlinks": ["src-rlhf-paper", "openai", "fine-tuning"]
    },
    {
      "slug": "chain-of-thought",
      "title": "Chain-of-Thought Prompting",
      "category": "concepts",
      "content": "## Chain-of-Thought Prompting\n\n**Tesi**: spingere l'LLM a ragionare step-by-step prima della risposta finale migliora drammaticamente performance su task complesse — soprattutto matematica e logica.\n\n## Varianti\n- **Few-shot CoT**: esempi con ragionamento esplicito nel prompt\n- **Zero-shot CoT**: \"Let's think step by step\"\n- **Tree of Thoughts**: esplorazione di rami multipli di ragionamento\n- **o1/o3** (OpenAI): CoT interno durante pretraining — non nel prompt\n\n## Perché Funziona\nL'[[attention-mechanism]] può distribuire compute su token intermedi di ragionamento, effettivamente aumentando la \"profondità computazionale\" del modello.\n\n## Correlate\n- [[transformer]]\n- [[attention-mechanism]]\n- [[context-window]]",
      "frontmatter": {"created": "2026-02-01", "updated": "2026-04-15", "tags": ["prompting", "reasoning", "technique"]},
      "links": ["transformer", "attention-mechanism", "context-window"],
      "backlinks": ["context-window"]
    },
    {
      "slug": "context-window",
      "title": "Context Window",
      "category": "concepts",
      "content": "## Context Window\n\n**Tesi**: la dimensione del context window è il principale fattore limitante dei LLM per task che richiedono elaborazione di documenti lunghi — ma più contesto non significa necessariamente migliore comprensione.\n\n## Evoluzione\n- GPT-2: 1024 token\n- GPT-3: 4096 token\n- GPT-4: 128K token\n- Claude 3: 200K token\n- Gemini 1.5 Pro: 1M token\n\n## Lost in the Middle\nI modelli degradano su informazioni nel mezzo del contesto — le informazioni all'inizio e alla fine sono recuperate meglio. Più contesto non è sempre meglio.\n\n## Correlate\n- [[transformer]]\n- [[attention-mechanism]]\n- [[rag-vs-fine-tuning]]",
      "frontmatter": {"created": "2026-02-05", "updated": "2026-04-20", "tags": ["architecture", "memory", "limitation"]},
      "links": ["transformer", "attention-mechanism", "rag-vs-fine-tuning"],
      "backlinks": ["transformer", "attention-mechanism", "chain-of-thought", "anthropic", "rag-vs-fine-tuning"]
    },
    {
      "slug": "tokenization",
      "title": "Tokenization",
      "category": "concepts",
      "content": "## Tokenization\n\n**Tesi**: la scelta del tokenizer ha impatti profondi su performance, efficienza e limitazioni del modello — BPE è lo standard de facto ma ha difetti non ovvi.\n\n## BPE (Byte-Pair Encoding)\n- Vocabolario costruito iterativamente fondendo le coppie più frequenti\n- GPT-4: ~100K token; Claude: ~100K token\n- Problema: caratteri rari = molti token (es. lingue non inglesi, codice)\n\n## Impatti Pratici\n- 1 token ≈ 0.75 parole inglesi ≈ 4 caratteri\n- Il [[context-window]] è in token, non parole\n- Matematica e codice sono spesso tokenizzati in modo subottimale\n\n## Correlate\n- [[transformer]]\n- [[context-window]]",
      "frontmatter": {"created": "2026-02-10", "updated": "2026-03-30", "tags": ["preprocessing", "nlp", "bpe"]},
      "links": ["transformer", "context-window"],
      "backlinks": ["transformer"]
    },
    {
      "slug": "fine-tuning",
      "title": "Fine-Tuning",
      "category": "concepts",
      "content": "## Fine-Tuning\n\n**Tesi**: il fine-tuning su dati di dominio specifico è il metodo più efficace per adattare un LLM a task specializzate — ma richiede dati di qualità, non quantità.\n\n## Approcci\n- **Full fine-tuning**: aggiornamento di tutti i parametri — costoso\n- **LoRA**: aggiornamento di matrici a basso rango — efficiente, quality comparabile\n- **QLoRA**: LoRA + quantizzazione 4-bit — addestrabile su consumer GPU\n- **SFT**: supervised fine-tuning su coppie input/output\n\n## Quando Usarlo vs RAG\nVedi [[rag-vs-fine-tuning]] per il confronto dettagliato.\n\n## Correlate\n- [[reinforcement-learning-from-human-feedback]]\n- [[rag-vs-fine-tuning]]\n- [[openai]]",
      "frontmatter": {"created": "2026-02-15", "updated": "2026-04-22", "tags": ["training", "adaptation", "lora"]},
      "links": ["reinforcement-learning-from-human-feedback", "rag-vs-fine-tuning", "openai"],
      "backlinks": ["src-scaling-laws", "src-rlhf-paper", "openai", "reinforcement-learning-from-human-feedback"]
    },
    {
      "slug": "llm-wiki-method",
      "title": "LLM Wiki Method",
      "category": "concepts",
      "content": "## LLM Wiki Method (metodo Karpathy)\n\n**Tesi**: usare un LLM come compilatore di una knowledge base in markdown è più pratico, economico e flessibile di qualsiasi sistema RAG con vector DB.\n\n## Principi Core\n1. **Distillazione** — le pagine diventano più precise nel tempo, mai più lunghe\n2. **Opinionata** — prendi posizione, non aggregare neutralmente\n3. **Zero note grezze** — ogni file in wiki/ è già distillato\n4. **Wikilinks** — la struttura emerge dai `[[link]]`\n\n## Confronto con RAG\n- RAG: embedding + vector search + retrieval in tempo reale\n- LLM Wiki: lettura diretta dei file + contesto ampio — più semplice, zero infrastruttura\n\n## Correlate\n- [[src-karpathy-llm-wiki]]\n- [[andrej-karpathy]]\n- [[rag-vs-fine-tuning]]",
      "frontmatter": {"created": "2026-01-05", "updated": "2026-04-30", "tags": ["method", "knowledge-management", "markdown"]},
      "links": ["src-karpathy-llm-wiki", "andrej-karpathy", "rag-vs-fine-tuning"],
      "backlinks": ["src-karpathy-llm-wiki", "andrej-karpathy", "rag-vs-fine-tuning"]
    },
    {
      "slug": "gpt-4-vs-claude",
      "title": "GPT-4 vs Claude — Confronto",
      "category": "comparisons",
      "content": "## GPT-4 vs Claude\n\n**Posizione**: per task di coding e analisi lunga, Claude 3.5 Sonnet supera GPT-4o; per integrazione ecosistema e multimodalità, GPT-4o rimane più versatile.\n\n## Confronto\n| Dimensione | GPT-4o | Claude 3.5 Sonnet |\n|---|---|---|\n| Context | 128K | 200K |\n| Coding | ★★★★☆ | ★★★★★ |\n| Ragionamento | ★★★★★ | ★★★★☆ |\n| Multimodalità | ★★★★★ | ★★★☆☆ |\n| API pricing | $5/1M | $3/1M |\n\n## Quando Scegliere Claude\n- Documenti lunghi, analisi di corpus\n- Coding (benchmark HumanEval: Claude +8%)\n- Ambienti safety-critical\n\n## Correlate\n- [[openai]]\n- [[anthropic]]\n- [[context-window]]",
      "frontmatter": {"created": "2026-03-01", "updated": "2026-04-25", "tags": ["comparison", "llm", "benchmark"]},
      "links": ["openai", "anthropic", "context-window"],
      "backlinks": ["openai", "anthropic", "src-attention-is-all-you-need"]
    },
    {
      "slug": "rag-vs-fine-tuning",
      "title": "RAG vs Fine-Tuning — Confronto",
      "category": "comparisons",
      "content": "## RAG vs Fine-Tuning\n\n**Posizione**: per la maggior parte dei casi d'uso aziendali, RAG è la scelta corretta — aggiornabile in tempo reale, senza training. Fine-tuning solo quando serve stile/comportamento specifico, non conoscenza.\n\n## Quando RAG\n- Dati aggiornati frequentemente\n- Knowledge base grande e variabile\n- Nessuna GPU disponibile\n- Serve citare le fonti esatte\n\n## Quando Fine-Tuning\n- Formato di output molto specifico\n- Stile o tono da modellare\n- Task narrow ben definita con molti esempi\n- Latenza critica (no retrieval overhead)\n\n## LLM Wiki come Alternativa\n[[llm-wiki-method]] è un approccio ibrido: nessun vector DB, l'LLM legge direttamente i file markdown con contesto ampio.\n\n## Correlate\n- [[fine-tuning]]\n- [[context-window]]\n- [[llm-wiki-method]]",
      "frontmatter": {"created": "2026-03-10", "updated": "2026-04-28", "tags": ["comparison", "architecture", "rag"]},
      "links": ["fine-tuning", "context-window", "llm-wiki-method"],
      "backlinks": ["src-karpathy-llm-wiki", "fine-tuning", "llm-wiki-method", "context-window"]
    }
  ],
  "categories": {
    "sources": "#3b82f6",
    "entities": "#22c55e",
    "concepts": "#f59e0b",
    "comparisons": "#a855f7"
  },
  "stats": {
    "total_pages": 18,
    "total_links": 68,
    "categories": {
      "sources": 4,
      "entities": 4,
      "concepts": 8,
      "comparisons": 2
    }
  }
};
