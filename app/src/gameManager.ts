import { Game } from "phaser";
import { UI_VIEW } from "./constants";
import { userIdentificationService } from "./services/userIdentification";
import type { GameRoomMetadata, Player } from "@game/shared";
import axios from "axios";
import { z } from "zod";
import { createIcons, LoaderCircle } from "lucide";
import { getRandomUnusedColor } from "@game/shared";

const ErrorMessageSchema = z.object({
  message: z.string(),
});

class GameManager {
  private hostName: string = "";
  private gameRoomMetadata: GameRoomMetadata | null = null;
  private modal: HTMLElement | null = null;
  private modalContent: HTMLElement | null = null;
  private startForm: HTMLFormElement | null = null;
  private startGameBtn: HTMLButtonElement | null = null;
  private startGameSpinner: HTMLElement | null = null;
  private errorMessage: HTMLElement | null = null;
  private submitButton: HTMLButtonElement | null = null;
  private loadingSpinner: HTMLElement | null = null;
  private joinForm: HTMLFormElement | null = null;

  constructor(private game: Game) {
    this.init();
  }

  private async init(): Promise<void> {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.handleInitialization());
    } else {
      await this.handleInitialization();
    }
  }

  private async handleInitialization(): Promise<void> {
    const roomId = this.getRoomIdFromUrl();
    if (roomId) {
      await this.handleExistingRoom(roomId);
    } else {
      await this.setup();
    }
  }

  private getRoomIdFromUrl(): string | null {
    const match = window.location.pathname.match(/^\/r\/([a-z0-9]+)$/);
    return match ? match[1] : null;
  }

  private async handleExistingRoom(roomId: string): Promise<void> {
    try {
      const response = await axios.get<{ data: GameRoomMetadata }>(`/api/v1/rooms/${roomId}`);
      this.gameRoomMetadata = response.data.data;

      const currentPlayer = this.findCurrentPlayer();

      if (currentPlayer) {
        await this.handleReconnection();
        return;
      }

      if (this.gameRoomMetadata.hasStarted) {
        await this.handleGameInProgress();
        return;
      }

      await this.setupJoinForm(roomId);
    } catch (error) {
      console.error("Error fetching game room:", error);
      await this.setup();
    }
  }

  private findCurrentPlayer(): Player | undefined {
    return this.gameRoomMetadata?.players.find((p: Player) => p.id === userIdentificationService.getId());
  }

  private async handleReconnection(): Promise<void> {
    console.log("reconnected");
    if (this.gameRoomMetadata?.hasStarted) {
      // TODO: handle game in progress
      console.log("game in progress");
    } else {
      await this.loadView(UI_VIEW.JOIN_ROOM_VIEW);
      this.setupRoomView();
    }
  }

  private async handleGameInProgress(): Promise<void> {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.showCreateRoomWithError());
    } else {
      await this.showCreateRoomWithError();
    }
  }

  private async setupJoinForm(roomId: string): Promise<void> {
    this.modal = document.getElementById("modal");
    this.modalContent = document.getElementById("modal-content");

    if (!this.modal || !this.modalContent) {
      console.error("Required modal elements not found");
      return;
    }

    await this.loadView(UI_VIEW.JOIN_FORM_VIEW);

    const hostNameDisplay = document.getElementById("host-name-display");
    if (hostNameDisplay && this.gameRoomMetadata) {
      const host = this.gameRoomMetadata.players.find((p: Player) => p.isHost);
      if (host) {
        hostNameDisplay.textContent = host.name;
      }
    }

    this.joinForm = document.getElementById("join-form") as HTMLFormElement;
    this.submitButton = document.getElementById("submit-btn") as HTMLButtonElement;
    this.loadingSpinner = document.getElementById("loading-spinner");

    if (!this.joinForm || !this.submitButton || !this.loadingSpinner) {
      console.error("Required form elements not found");
      return;
    }

    this.initializeLoadingSpinner(this.loadingSpinner);
    this.joinForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      this.hideError();

      const formData = new FormData(event.target as HTMLFormElement);
      const playerName = formData.get("player-name")?.toString() ?? "";

      if (!playerName) {
        this.showError("Player name is required");
        return;
      }

      try {
        this.showLoading(this.submitButton!, this.loadingSpinner!);

        const usedColors = this.gameRoomMetadata?.players.map((p: Player) => p.color) ?? [];
        const response = await axios.post<{ data: GameRoomMetadata }>(`/api/v1/rooms/${roomId}/join`, {
          playerName,
          playerId: userIdentificationService.getId(),
          color: getRandomUnusedColor(usedColors),
        });

        this.gameRoomMetadata = response.data.data;
        await this.loadView(UI_VIEW.JOIN_ROOM_VIEW);
        this.setupRoomView();
      } catch (error) {
        console.error("Error joining game:", error);
        if (axios.isAxiosError(error) && error.response?.data) {
          try {
            const errorData = ErrorMessageSchema.parse(error.response.data);
            this.showError(errorData.message);
          } catch {
            this.showError("Failed to join game");
          }
        } else {
          this.showError("Failed to join game");
        }
      } finally {
        if (this.submitButton && this.loadingSpinner) {
          this.hideLoading(this.submitButton, this.loadingSpinner);
        }
      }
    });
  }

  private async showCreateRoomWithError(): Promise<void> {
    await this.setup();
    this.showError("Game is in progress, but you can create a new game here");
  }

  private showLoading(button: HTMLButtonElement, spinner: HTMLElement): void {
    if (!button || !spinner) return;
    button.disabled = true;
    spinner.classList.remove("hidden");
  }

  private hideLoading(button: HTMLButtonElement, spinner: HTMLElement): void {
    if (!button || !spinner) return;
    button.disabled = false;
    spinner.classList.add("hidden");
  }

  private initializeLoadingSpinner(spinner: HTMLElement): void {
    spinner.innerHTML = `<i data-lucide="loader-circle" class="animate-spin" style="width: 20px; height: 20px;"></i>`;
    createIcons({
      icons: {
        "loader-circle": LoaderCircle,
      },
    });
  }

  private showError(message: string): void {
    if (!this.errorMessage) {
      this.errorMessage = document.createElement("div");
      this.errorMessage.className = "text-red-500 text-sm mt-2";
      this.startForm?.appendChild(this.errorMessage);
    }
    this.errorMessage.textContent = message;
    this.errorMessage.classList.remove("hidden");
  }

  private hideError(): void {
    this.errorMessage?.classList.add("hidden");
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
      const response = await axios.get(`/src/views/${viewName}.html`);
      if (this.modalContent) {
        this.modalContent.innerHTML = response.data;

        if (viewName === UI_VIEW.JOIN_ROOM_VIEW) {
          this.setupRoomView();
        }
      }
    } catch (error) {
      console.error("Error loading view:", error);
      this.showError("Failed to load view");
    }
  }

  private setupRoomView(): void {
    const hostNameElement = document.getElementById("host-name");
    const playerNameElement = document.getElementById("player-name");
    const roomLinkElement = document.getElementById("room-link");
    this.startGameBtn = document.getElementById("start-game-btn") as HTMLButtonElement;
    this.startGameSpinner = document.getElementById("start-game-spinner");

    if (hostNameElement) hostNameElement.textContent = this.hostName;
    if (playerNameElement) playerNameElement.textContent = this.hostName;
    if (roomLinkElement && this.gameRoomMetadata) {
      const roomUrl = new URL(window.location.origin);
      roomUrl.pathname = `/r/${this.gameRoomMetadata.id}`;
      window.history.replaceState({}, "", roomUrl.toString());
      roomLinkElement.textContent = roomUrl.toString();
    }

    if (this.startGameBtn && this.startGameSpinner) {
      this.initializeLoadingSpinner(this.startGameSpinner);
      this.startGameBtn.addEventListener("click", this.handleStartGame.bind(this));
    }
  }

  private setupStartView(): void {
    this.startForm = document.getElementById("start-form") as HTMLFormElement;
    this.submitButton = document.getElementById("submit-btn") as HTMLButtonElement;
    this.loadingSpinner = document.getElementById("loading-spinner");

    if (!this.startForm || !this.submitButton || !this.loadingSpinner) {
      console.error("Required form elements not found");
      return;
    }

    this.initializeLoadingSpinner(this.loadingSpinner);
    this.startForm.addEventListener("submit", this.handleStartForm.bind(this));
  }

  private async handleStartForm(event: Event): Promise<void> {
    event.preventDefault();
    this.hideError();

    const formData = new FormData(event.target as HTMLFormElement);
    this.hostName = formData.get("player-name")?.toString() ?? "";

    if (!this.hostName) {
      this.showError("Player name is required");
      return;
    }

    try {
      if (!this.submitButton || !this.loadingSpinner) return;
      this.showLoading(this.submitButton, this.loadingSpinner);

      const response = await axios.post<{ data: GameRoomMetadata }>("/api/v1/rooms", {
        hostName: this.hostName,
        hostId: userIdentificationService.getId(),
      });

      this.gameRoomMetadata = response.data.data;
      await this.loadView(UI_VIEW.JOIN_ROOM_VIEW);
    } catch (error) {
      console.error("Error creating game room:", error);

      if (axios.isAxiosError(error) && error.response?.data) {
        try {
          // try to parse error message from response
          const errorData = ErrorMessageSchema.parse(error.response.data);
          this.showError(errorData.message);
        } catch {
          // if can't parse, show generic error
          this.showError("Failed to create game room");
        }
      } else {
        this.showError("Failed to create game room");
      }
    } finally {
      if (this.submitButton && this.loadingSpinner) {
        this.hideLoading(this.submitButton, this.loadingSpinner);
      }
    }
  }

  private async handleStartGame(): Promise<void> {
    if (!this.startGameBtn || !this.startGameSpinner) return;

    try {
      this.showLoading(this.startGameBtn, this.startGameSpinner);
      // TODO: remove this
      await new Promise((resolve) => setTimeout(resolve, 1000));

      this.hideModal();
      this.game.scene.start("Game", { playerName: this.hostName });
    } catch (error) {
      console.error("Error starting game:", error);
    } finally {
      this.hideLoading(this.startGameBtn, this.startGameSpinner);
    }
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
