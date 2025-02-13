import { Game } from "phaser";
import { UI_VIEW } from "./constants";

class GameManager {
  private hostName: string = "";
  private modal: HTMLElement | null = null;
  private modalContent: HTMLElement | null = null;
  private startForm: HTMLFormElement | null = null;
  private startGameBtn: HTMLButtonElement | null = null;

  constructor(private game: Game) {
    this.init();
  }

  private init(): void {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.setup());
    } else {
      this.setup();
    }
  }

  private async setup(): Promise<void> {
    this.modal = document.getElementById("modal");
    this.modalContent = document.getElementById("modal-content");

    if (!this.modal || !this.modalContent) {
      console.error("Required modal elements not found");
      return;
    }

    await this.loadView(UI_VIEW.CREATE_ROOM_VIEW);
    this.setupStartView();
  }

  private async loadView(viewName: string): Promise<void> {
    try {
      const response = await fetch(`/src/views/${viewName}.html`);
      if (!response.ok) throw new Error(`Failed to load view: ${viewName}`);

      const html = await response.text();
      if (this.modalContent) {
        this.modalContent.innerHTML = html;

        if (viewName === UI_VIEW.JOIN_ROOM_VIEW) {
          this.setupRoomView();
        }
      }
    } catch (error) {
      console.error("Error loading view:", error);
    }
  }

  private setupRoomView(): void {
    const hostNameElement = document.getElementById("host-name");
    const playerNameElement = document.getElementById("player-name");
    const roomLinkElement = document.getElementById("room-link");
    this.startGameBtn = document.getElementById("start-game-btn") as HTMLButtonElement;

    if (hostNameElement) hostNameElement.textContent = this.hostName;
    if (playerNameElement) playerNameElement.textContent = this.hostName;
    if (roomLinkElement) roomLinkElement.textContent = window.location.href;

    this.startGameBtn?.addEventListener("click", this.handleStartGame.bind(this));
  }

  private setupStartView(): void {
    this.startForm = document.getElementById("start-form") as HTMLFormElement;

    if (!this.startForm) {
      console.error("Start form not found");
      return;
    }

    this.startForm.addEventListener("submit", this.handleStartForm.bind(this));
  }

  private handleStartForm(event: Event): void {
    event.preventDefault();

    const formData = new FormData(event.target as HTMLFormElement);
    this.hostName = formData.get("player-name")?.toString() ?? "";

    if (!this.hostName) {
      console.error("Player name is required");
      return;
    }

    this.loadView(UI_VIEW.JOIN_ROOM_VIEW);
  }

  private handleStartGame(): void {
    this.hideModal();
    this.game.scene.start("Game", { playerName: this.hostName });
  }

  public getHostName(): string {
    return this.hostName;
  }

  public showModal(): void {
    this.modal?.classList.remove("hidden");
  }

  public hideModal(): void {
    this.modal?.classList.add("hidden");
  }
}

export default GameManager;
