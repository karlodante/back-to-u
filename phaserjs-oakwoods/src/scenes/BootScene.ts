import Phaser from "phaser";

interface AssetManifest {
  meta: {
    basePath: string;
  };
  images: {
    backgrounds: Array<{ key: string; path: string }>;
    decorations: Array<{ key: string; path: string }>;
  };
  spritesheets: {
    character: {
      key: string;
      path: string;
      frameWidth: number;
      frameHeight: number;
      animations: Array<{
        key: string;
        startFrame: number;
        endFrame: number;
        frameRate: number;
        repeat: number;
      }>;
    };
  };
  tilesets: {
    main: {
      key: string;
      path: string;
    };
  };
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    // If art assets are missing, the loader will fail. Track failures so we can
    // show an actionable message instead of starting the game with missing textures.
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: any) => {
      const list = (this.registry.get("oakwoods-missing-files") as string[] | undefined) ?? [];
      const key = typeof file?.key === "string" ? file.key : "unknown";
      const url = typeof file?.url === "string" ? file.url : undefined;
      list.push(url ? `${key} (${url})` : key);
      this.registry.set("oakwoods-missing-files", list);
    });

    // Display loading text
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    this.add.text(width / 2, height / 2, "Loading...", {
      fontSize: "16px",
      color: "#ffffff",
    }).setOrigin(0.5);

    // Load the asset manifest
    this.load.json("oakwoods-manifest", "assets/oakwoods/assets.json");
  }

  create(): void {
    const manifest = this.cache.json.get("oakwoods-manifest") as AssetManifest;
    if (!manifest?.meta?.basePath) {
      const width = this.cameras.main.width;
      const height = this.cameras.main.height;
      this.add.text(
        10,
        10,
        [
          "Missing manifest:",
          "public/assets/oakwoods/assets.json",
          "",
          "See the repo README for setup.",
        ].join("\n"),
        { fontSize: "12px", color: "#ffffff", wordWrap: { width: width - 20 } },
      );
      return;
    }

    const basePath = manifest.meta.basePath;

    // Queue all assets for loading
    // Background images
    for (const bg of manifest.images.backgrounds) {
      this.load.image(bg.key, `${basePath}/${bg.path}`);
    }

    // Decoration images (for future use)
    for (const dec of manifest.images.decorations) {
      this.load.image(dec.key, `${basePath}/${dec.path}`);
    }

    // Character spritesheet
    const char = manifest.spritesheets.character;
    this.load.spritesheet(char.key, `${basePath}/${char.path}`, {
      frameWidth: char.frameWidth,
      frameHeight: char.frameHeight,
    });

    // Tileset image
    const tileset = manifest.tilesets.main;
    this.load.image(tileset.key, `${basePath}/${tileset.path}`);

    // === SPRITES PERSONALIZADOS KARLO - NOMBRES EXACTOS ===
    console.log("🔍 DEBUG: Cargando sprites con nombres exactos...");
    
    // Wara - Cargar como imágenes individuales (no spritesheets)
    console.log("🔍 DEBUG: Cargando sprites individuales de Wara...");
    
    this.load.image('wara_idle', 'assets_karlo/Wara REPOSO PNG.png');
    this.load.image('wara_walk', 'assets_karlo/Wara CAMINATA PNG.png');
    this.load.image('wara_run', 'assets_karlo/Wara CORRER PNG.png');
    this.load.image('wara_jump', 'assets_karlo/Wara SALTO PNG.png');
    this.load.image('wara_attack', 'assets_karlo/Wara ATACANDO PNG.png');
    this.load.image('wara_air_attack', 'assets_karlo/Wara ATACANDO EN EL AIRE PNG.png');

    // Enemigos - Alma en pena (cargar como imágenes individuales)
    this.load.image('alma_idle', 'assets_karlo/Alma en pena reposo.png');
    this.load.image('alma_angry', 'assets_karlo/Alma en pena enojada reposo.png');
    this.load.image('alma_very_angry', 'assets_karlo/Alma en pena más enojada reposot.png');
    this.load.image('alma_death', 'assets_karlo/Alma en pena muerte.png');
    this.load.image('alma_angry_death', 'assets_karlo/Alma en pena más enojada muerte.png');

    // Enemigos - Sirviente (cargar como imágenes individuales)
    this.load.image('sirviente_idle', 'assets_karlo/Sirviente Pirichuchio aleteot.png');
    this.load.image('sirviente_attack', 'assets_karlo/Sirviente Golpecito.png');
    console.log("📦 DEBUG: Cargando Sirviente Golpecito.png → sirviente_attack");
    
    this.load.image('sirviente_death', 'assets_karlo/MUERTE sirviente Pirichuchio.png');
    console.log("📦 DEBUG: Cargando MUERTE sirviente Pirichuchio.png → sirviente_death");

    // PACHITA (usando Abby como alternativa)
    this.load.image('abby_idle', 'assets_karlo/Abby REPOSO PNG.png');
    console.log("📦 DEBUG: Cargando Abby REPOSO PNG.png → abby_idle");
    
    this.load.image('abby_walk', 'assets_karlo/Abby CAMINATA PNG.png');
    console.log("📦 DEBUG: Cargando Abby CAMINATA PNG.png → abby_walk");
    
    this.load.image('abby_run', 'assets_karlo/Abby CORRER PNG.png');
    console.log("📦 DEBUG: Cargando Abby CORRER PNG.png → abby_run");
    
    this.load.image('abby_jump', 'assets_karlo/Abby SALTO PNG.png');
    console.log("📦 DEBUG: Cargando Abby SALTO PNG.png → abby_jump");
    
    // Decoración adicional
    this.load.image('grass_tiles', 'assets_karlo/Cuadros pasto PNG.png');

    console.log("✅ DEBUG: Todos los assets_karlo configurados para cargar");

    // Start loading and transition to GameScene when complete
    this.load.once("complete", () => {
      const missing = (this.registry.get("oakwoods-missing-files") as string[] | undefined) ?? [];
      if (missing.length > 0) {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const preview = missing.slice(0, 6).map((s) => `- ${s}`).join("\n");
        this.add.text(
          10,
          10,
          [
            "Missing Oak Woods art assets.",
            "",
            "Download + extract the pack into:",
            "public/assets/oakwoods/",
            "",
            "Example missing files:",
            preview,
            missing.length > 6 ? `\n(and ${missing.length - 6} more)` : "",
            "",
            "See the repo README for setup + credits.",
          ].join("\n"),
          { fontSize: "12px", color: "#ffffff", wordWrap: { width: width - 20 } },
        );
        return;
      }
      this.scene.start("GameScene");
    });

    this.load.start();
  }
}
