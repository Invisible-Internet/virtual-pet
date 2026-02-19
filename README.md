# 🐾 Virtual Pet

An interactive 2D desktop companion built with **Electron** and a hybrid layered sprite animation system.

This project creates a playful virtual pet that lives on your desktop. You can drag it, fling it, let it wander, change its outfits, and eventually integrate it with an AI backend for conversational interaction.

The architecture is modular, extensible, and designed to support community-contributed avatar packs.

---

## ✨ Features

### Core Interaction
- Frameless, transparent Electron window
- Drag-and-drop movement
- Fling physics with inertia
- Screen-edge bounce
- Free-floating screen-space movement

### Animation System
- True 8-direction walk cycles
- Hybrid sprite system:
  - Flipbook body animations
  - Layered face components (eyes, brows, mouth shapes)
  - Accessory overlays (hood, headphones, hair, etc.)
- State-driven animation switching (idle, walking, sleeping, thinking, speaking)

### Wardrobe System
- Outfit packs
- Optional accessory layers
- Animation sets per outfit

### AI Integration (Planned)
- TTS-driven mouth animation
- Emotional state switching
- Single-presence model (desktop / browser / mobile)

---

## 🧠 Architecture Overview

The system uses a hybrid animation approach:

- **Body animations** → Flipbook sprite sequences (e.g., 8-direction walk cycles)
- **Face and accessories** → Layered compositing for dynamic expressions
- **Physics simulation** → Drives window movement and accessory motion
- **Electron main process** → Controls desktop window positioning
- **Renderer process** → Handles animation, input, and state logic

This separation allows:

- Responsive desktop interaction
- Dynamic emotional expression
- Extensible avatar packs
- Future multi-device support

---

## 📁 Project Structure
```
virtual-pet/
│
├── main.js          # Electron main process
├── preload.js       # Secure IPC bridge
├── index.html       # Renderer entry
├── renderer.js      # Animation & interaction logic
├── package.json
│
└── avatars/
    └── Primea/
        ├── manifest.json
        ├── outfits/
        │   └── base/
        │       ├── body/
        │       │   └── walk/
        │       │       ├── N/
        │       │       ├── NE/
        │       │       └── ...
        │       ├── overlays/
        │       └── face/
        └── anchors/
```
---

# 🚀 Getting Started

### 1️⃣ Clone the Repository

```
git clone https://github.com/your-username/virtual-pet.git
cd virtual-pet
```

### 2️⃣ Install Dependencies

```
npm install
```

### 3️⃣ Run the Application

```
npm start
```

---

# 🖼️ Sprite Rendering Workflow (Maya → 2D)

### The avatar uses a 3D-to-2D sprite pipeline:
1. Lock a 3/4 isometric camera angle in Maya.
2. Animate a seamless looping walk cycle.
3. Render 12–18 frames for the animation loop.
4. Rotate the character rig in 45° increments.
5. Render all 8 directional sprite sets (N, NE, E, SE, S, SW, W, NW).
6. Export facial layers and accessory elements separately for compositing.

### This enables:
- True 8-direction movement
- Dynamic facial expressions
- Layer-based accessories
- Efficient wardrobe system

---

# 🎮 Controls (Planned)

### Controls:
- Mouse Drag – Move the pet
- Release – Fling with inertia
- WASD – Manual movement (future)
- Idle Time – Automatic emotes or sleep state

---

# 🧩 Avatar Pack Format (Planned Spec)

### Each avatar should include:
- Body animations (walk, idle, etc.)
- Directional sprite folders (N, NE, E, SE, S, SW, W, NW)
- Face layers (eyes, brows, mouth shapes)
- Optional overlays (hair, hood, headphones)
- Anchor metadata for compositing

##### Example:
```
walk/N/0001.png
face/mouth_01.png
overlays/hood_up.png
anchors/walk_N.json
```

---

# 🗺️ Roadmap

### Phase 1
- Drag + fling physics
- Idle state
- Layered face rendering

### Phase 2
- 8-direction walk cycle
- Random wandering
- Basic state machine

### Phase 3
- Wardrobe system
- Accessory physics
- WASD controls

### Phase 4
- AI backend integration
- Speech-driven mouth sync
- Multi-device presence

---

# 📜 License

MIT License

---

# 🤝 Contributing

### Contributions are welcome.

#### Planned contribution areas:
- Avatar sprite packs
- Animation improvements
- Physics tuning
- State system enhancements
- AI integration modules

Please open issues or submit pull requests.

---

# 🎯 Vision

### This project aims to create a lightweight, expressive desktop companion that blends:
- 2D animation
- Physics-based interaction
- Emotional state modeling
- AI-driven personality

The goal is a system that feels alive, playful, and extensible — something that can evolve from a simple desktop pet into a full digital companion.

