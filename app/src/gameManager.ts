import { Game } from "phaser";

class GameManager {
  private playerName: string = "";
  private startModal: HTMLElement | null = null;
  private startForm: HTMLFormElement | null = null;

  constructor(private game: Game) {
    this.init();
  }

  private init(): void {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.setupEventListeners());
    } else {
      this.setupEventListeners();
    }
  }

  private setupEventListeners(): void {
    this.startModal = document.getElementById("start-modal");
    this.startForm = document.getElementById("start-form") as HTMLFormElement;

    if (!this.startForm || !this.startModal) {
      console.error("Required elements not found");
      return;
    }

    this.startForm.addEventListener("submit", this.handleStartGame.bind(this));
  }

  private handleStartGame(event: Event): void {
    event.preventDefault();

    const formData = new FormData(event.target as HTMLFormElement);
    this.playerName = formData.get("player-name")?.toString() ?? "";

    if (!this.playerName) {
      console.error("Player name is required");
      return;
    }

    console.log("Starting game with player name: ", this.playerName);

    // hide the start modal
    this.startModal?.classList.add("hidden");

    // start the game scene with player data
    this.game.scene.start("Game", { playerName: this.playerName });
  }

  public getPlayerName(): string {
    return this.playerName;
  }
}

export default GameManager;
