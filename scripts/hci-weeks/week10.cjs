// HCI Week 10 Questions (10 Assignment + 10 Probable Practice)
module.exports = [
  {
    "qNum": 1,
    "type": "assignment",
    "text": "Large Language Models (LLMs) are mainly used to:",
    "options": {
      "A": "Store data",
      "B": "Understand and generate text",
      "C": "Build hardware",
      "D": "Manage networks"
    },
    "answer": "B",
    "explanation": "An LLM is “a super-smart assistant that can understand and generate text”.",
    "page": 114
  },
  {
    "qNum": 2,
    "type": "assignment",
    "text": "Behaviour refers to:",
    "options": {
      "A": "System performance",
      "B": "Data processing",
      "C": "Actions or reactions of individuals",
      "D": "Software debugging"
    },
    "answer": "C",
    "explanation": "“Behavior: refers to actions or reactions of individuals in response to external or internal stimuli.”",
    "page": 114
  },
  {
    "qNum": 3,
    "type": "assignment",
    "text": "LLMs improve interfaces by:",
    "options": {
      "A": "Replacing UI",
      "B": "Increasing hardware",
      "C": "Enabling natural language interaction",
      "D": "Reducing usability"
    },
    "answer": "C",
    "explanation": "“LLMs make it possible for users to interact with systems in natural language, removing the need for technical knowledge or complex commands.”",
    "page": 114
  },
  {
    "qNum": 4,
    "type": "assignment",
    "text": "Multimodal LLMs process:",
    "options": {
      "A": "Only text",
      "B": "Only images",
      "C": "Only audio",
      "D": "Multiple data types (text, image, etc.)"
    },
    "answer": "D",
    "explanation": "MLLMs “process and integrate multiple types of inputs, such as text, images, audio, and video”.",
    "page": 114
  },
  {
    "qNum": 5,
    "type": "assignment",
    "text": "Zero-shot prompting means:",
    "options": {
      "A": "Training with no data",
      "B": "Using examples before prediction",
      "C": "Asking directly without examples",
      "D": "Using reinforcement learning"
    },
    "answer": "C",
    "explanation": "“Zero shot prompting: simply feed the task text to the model and ask for results.” Using examples is few-shot (option B).",
    "page": 115
  },
  {
    "qNum": 6,
    "type": "assignment",
    "text": "Few-shot prompting helps by:",
    "options": {
      "A": "Increasing latency",
      "B": "Providing examples to guide the model",
      "C": "Reducing accuracy",
      "D": "Removing context"
    },
    "answer": "B",
    "explanation": "“We provide demonstrations in the prompt to steer the model to better performance.”",
    "page": 115
  },
  {
    "qNum": 7,
    "type": "assignment",
    "text": "Adaptive learning systems use:",
    "options": {
      "A": "Static content",
      "B": "Fixed curriculum",
      "C": "Personalized content based on user performance",
      "D": "Random teaching"
    },
    "answer": "C",
    "explanation": "They “personalize the learning experience by adjusting content based on individual needs and performance”.",
    "page": 115
  },
  {
    "qNum": 8,
    "type": "assignment",
    "text": "LLMs contribute to accessibility by:",
    "options": {
      "A": "Reducing data",
      "B": "Providing voice and text alternatives",
      "C": "Increasing complexity",
      "D": "Removing UI"
    },
    "answer": "B",
    "explanation": "LLMs enable voice commands, generate alternative text for images and video, and offer alternative formats (text, audio, visuals).",
    "page": 115
  },
  {
    "qNum": 9,
    "type": "assignment",
    "text": "A key challenge in behaviour prediction is:",
    "options": {
      "A": "Too little data",
      "B": "Hardware cost",
      "C": "Deciding what, when, and to whom to show content",
      "D": "Lack of UI"
    },
    "answer": "C",
    "explanation": "Challenges slide: predicting “What to show? How to show? Where to show? When to show? To whom to show?”",
    "page": 115
  },
  {
    "qNum": 10,
    "type": "assignment",
    "text": "Ethical concern in LLM + HCI systems:",
    "options": {
      "A": "Speed",
      "B": "UI design",
      "C": "Privacy and manipulation risks",
      "D": "Storage"
    },
    "answer": "C",
    "explanation": "Ethical considerations: “Avoiding manipulation while using behavioral insights” and “Ensuring privacy and transparency in data use”.",
    "page": 116
  },
  {
    "qNum": "P1",
    "type": "other",
    "text": "In the lecture, “emergence” in LLMs refers to:",
    "options": {
      "A": "Models becoming smaller",
      "B": "Removal of attention layers",
      "C": "Quantitative changes in scale producing qualitative changes in behaviour",
      "D": "Training only on images"
    },
    "answer": "C",
    "explanation": "Emergence: quantitative changes result in qualitative changes; new capabilities appear with scale.",
    "page": 117
  },
  {
    "qNum": "P2",
    "type": "other",
    "text": "Which paper introduced the Transformer architecture cited in the lecture?",
    "options": {
      "A": "ImageNet Classification with Deep CNNs",
      "B": "Generative Adversarial Nets",
      "C": "Attention is All You Need (NIPS 2017)",
      "D": "BERT"
    },
    "answer": "C",
    "explanation": "The architecture slide cites “Attention is all you need”, NIPS ’17.",
    "page": 117
  },
  {
    "qNum": "P3",
    "type": "other",
    "text": "Fine-tuning a pretrained model on (task instruction, input, ground-truth output) tuples is called:",
    "options": {
      "A": "Zero-shot prompting",
      "B": "Instruction prompting",
      "C": "Few-shot prompting",
      "D": "Chain-of-thought prompting"
    },
    "answer": "B",
    "explanation": "Instruction prompting, e.g. InstructGPT and Natural Instructions.",
    "page": 117
  },
  {
    "qNum": "P4",
    "type": "other",
    "text": "Which statement about Perplexity AI is correct according to the lecture?",
    "options": {
      "A": "It combines LLM reasoning with real-time web search and gives cited answers",
      "B": "It is an offline grammar checker",
      "C": "It generates only videos",
      "D": "It is a hardware accelerator"
    },
    "answer": "A",
    "explanation": "Perplexity is an AI-powered search engine with real-time retrieval and citations.",
    "page": 117
  },
  {
    "qNum": "P5",
    "type": "other",
    "text": "DeepSeek-MoE uses which architecture?",
    "options": {
      "A": "Mixture-of-Experts",
      "B": "Recurrent Neural Network",
      "C": "Support Vector Machine",
      "D": "Decision tree"
    },
    "answer": "A",
    "explanation": "MoE = Mixture-of-Experts for efficient large-scale performance.",
    "page": 117
  },
  {
    "qNum": "P6",
    "type": "other",
    "text": "Which is NOT given as an example of a multimodal LLM?",
    "options": {
      "A": "GPT-4",
      "B": "Gemini",
      "C": "LLaVA",
      "D": "Excel"
    },
    "answer": "D",
    "explanation": "GPT-4, Gemini and LLaVA are the slide’s examples.",
    "page": 118
  },
  {
    "qNum": "P7",
    "type": "other",
    "text": "In Tutorial 10, a food-delivery pop-up appearing around dinner time illustrates which aspect of persuasion?",
    "options": {
      "A": "Text style",
      "B": "Encryption",
      "C": "Data minimisation",
      "D": "Timing in presentation"
    },
    "answer": "D",
    "explanation": "Step 2 – Presentation: timing (when the message appears) matters.",
    "page": 118
  },
  {
    "qNum": "P8",
    "type": "other",
    "text": "The five communication components used in Large Content and Behavior Models are:",
    "options": {
      "A": "Sender, Code, Noise, Wire, Output",
      "B": "Plan, Do, Check, Act, Review",
      "C": "Input, Process, Store, Output, Feedback",
      "D": "Communicator, Message, Channel, Receiver, Effect"
    },
    "answer": "D",
    "explanation": "Khandelwal et al. (2024) model Communicator, Message, Channel, Receiver and Effect.",
    "page": 118
  },
  {
    "qNum": "P9",
    "type": "other",
    "text": "Kyron’s “blind evaluation” service mainly aims to:",
    "options": {
      "A": "Remove bias by anonymising candidates",
      "B": "Speed up video rendering",
      "C": "Translate speech",
      "D": "Generate images"
    },
    "answer": "A",
    "explanation": "Blind evaluations anonymise candidates so decisions focus on skills.",
    "page": 118
  },
  {
    "qNum": "P10",
    "type": "other",
    "text": "The lecture’s vision of “re-imagining mobile phones” is a shift from:",
    "options": {
      "A": "Touch to keyboards",
      "B": "A phone full of apps to a phone as an assistant",
      "C": "Colour to monochrome screens",
      "D": "Wi-Fi to wired networks"
    },
    "answer": "B",
    "explanation": "An LLM-powered phone handles multi-step tasks conversationally instead of the user switching apps.",
    "page": 118
  }
];
