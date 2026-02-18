Virtual Pet
An interactive 2D desktop companion built with Electron and layered sprite animation.
This project aims to create a playful, expressive virtual pet that lives on your desktop, can be dragged and flung with physics, wander freely, emote, change outfits, and eventually integrate with an AI backend (such as OpenClaw) for conversational interaction. The system is designed to be modular, extensible, and friendly for community-contributed avatar packs. ✨

Features (Planned & In Progress)
Core Interaction
Frameless, transparent Electron window
Drag-and-drop movement
Fling physics with inertia and screen-edge bounce
Free-floating screen-space movement
Animation System
True 8-direction walk cycles
Layered face system (eyes, brows, mouth shapes)
Accessory overlays (hair, hood, headphones, etc.)
State-driven animation switching (idle, walking, sleeping, thinking, speaking)
Wardrobe System
Outfit packs
Optional accessory layers
Support for animation sets per outfit
AI Integration (Future)
TTS-driven mouth animation
Emotional state switching
Single-presence model (desktop / browser / mobile)

🧠 Architecture Overview
The project uses a hybrid animation system: Body animations use flipbook sprite sequences (e.g., 8-direction walk cycles). Face and accessories use layered sprite compositing for dynamic expressions and physics-driven motion. Physics simulation drives window movement and accessory behavior. Electron main process handles window positioning and desktop integration. Renderer process handles animation, input, and state logic. This separation allows:
Responsive desktop interaction
Dynamic emotional expressions
Extensible avatar packs
Future multi-device support

🗂 Project Structure
virtual-pet/
│
├── main.js # Electron main process
├── preload.js # Secure IPC bridge
├── index.html # Renderer entry
├── renderer.js # Animation & interaction logic
├── package.json
│   └── avatars/
│       └── Primea/
│           ├── manifest.json
│           ├── outfits/
│           │   └── base/
│           │       ├── body/
│           │       │   └── walk/
│           │       │       ├── N/
│           │       │       ├── NE/
│           │       │       └── ...
│           │       ├── overlays/
│           │       └── face/
│           └── anchors/

🚀 Getting Started
1. Clone the Repository
   git clone https://github.com/your-username/virtual-pet.git
   cd virtual-pet
2. Install Dependencies
   npm install
3. Run the Application
   npm start

🖼 Sprite Rendering Workflow (Maya → 2D)
The avatar uses a 3D-to-2D sprite pipeline:
Lock a 3/4 camera angle in Maya.
Animate a looping walk cycle.
Render 12–18 frames.
Rotate the rig 45° increments.
Render 8 directional sprite sets.
Export face and accessory layers separately.
This enables:
True 8-direction movement
Dynamic facial expressions
Layer-based accessories
Efficient wardrobe system

🎮 Controls (Planned)
Mouse Drag – Move the pet
Release – Fling with inertia
WASD – Manual movement (future)
Idle Time – Automatic emotes or sleep state

🧩 Avatar Pack Format (Planned Spec)
Each avatar should include:
Body animations (walk, idle, etc.)
Directional sprite folders (N, NE, E, SE, S, SW, W, NW)
Face layers (eyes, brows, mouth shapes)
Optional overlays (hair, hood, headphones)
Anchor metadata for compositing
Example: walk/N/0001.png face/mouth_01.png overlays/hood_up.png anchors/walk_N.json

🛣 Roadmap
Phase 1
Drag + fling physics
Idle state
Layered face rendering
Phase 2
8-direction walk cycle
Random wandering
Basic state machine
Phase 3
Wardrobe system
Accessory physics
WASD controls
Phase 4
AI backend integration
Speech-driven mouth sync
Multi-device presence

📜 License
MIT License

🤝 Contributing
Contributions are welcome. Planned contribution areas:
Avatar sprite packs
Animation improvements
Physics tuning
State system enhancements
AI integration modules
Please open issues or submit pull requests.

🎯 Vision
This project aims to create a lightweight, expressive desktop companion that blends:
2D animation
Physics-based interaction
Emotional state modeling
AI-driven personality
The goal is a system that feels alive, playful, and extensible — something that can evolve from a simple desktop pet into a full digital companion.
