import { Game } from "phaser";
import { UI_VIEW } from "./constants";
import { userIdentificationService } from "./services/userIdentification";
import type { GameRoomMetadata, Player, PlayerWithStatus } from "@game/shared";
import { PlayerStatus } from "@game/shared";
import { z } from "zod";
import { Check, Copy, createIcons, LoaderCircle } from "lucide";
import { apiService } from "./services/api";
import { viewLoader } from "./services/viewLoader";
import { socketService } from "./services/socketService";
import type { AxiosError } from "axios";
// @ts-expect-error - Toastify is not typed
import Toastify from "toastify-js";

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
  private patternSelection: HTMLElement | null = null;

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
    this.setupModal();
    const roomId = this.getRoomIdFromUrl();
    if (roomId) {
      await this.handleExistingRoom(roomId);
      return;
    }
    await this.setup();
  }

  private getRoomIdFromUrl(): string | null {
    const match = window.location.pathname.match(/^\/r\/([a-z0-9]+)$/);
    return match ? match[1] : null;
  }

  private async handleExistingRoom(roomId: string): Promise<void> {
    try {
      this.gameRoomMetadata = await apiService.getRoomById(roomId);

      if (!this.gameRoomMetadata) {
        window.history.replaceState({}, "", "/");
        await this.setup();
        return;
      }

      const currentPlayer = this.findCurrentPlayer();

      if (currentPlayer) {
        await this.handleReconnection(currentPlayer);
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
    return this.gameRoomMetadata?.players.find(
      (p: Player) => p.id === userIdentificationService.getId(),
    );
  }

  private async handleReconnection(currentPlayer: Player): Promise<void> {
    if (!this.gameRoomMetadata) {
      console.error("Game room metadata is required for reconnection");
      return;
    }

    try {
      // establish socket connection
      socketService.connect();

      // setup socket event handlers before joining room
      this.setupSocketEventHandlers();

      await socketService.joinRoom(this.gameRoomMetadata.id, currentPlayer.id, currentPlayer.name);

      if (this.gameRoomMetadata.hasStarted) {
        this.startGame(this.gameRoomMetadata);
      } else {
        await this.loadView(UI_VIEW.JOIN_ROOM_VIEW);
        this.setupJoinRoomView();
      }
    } catch (error) {
      console.error("Error reconnecting to room:", error);
      // fallback to create room view if reconnection fails
      await this.setup();
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

      await this.handleJoinFormSubmit(roomId, playerName);
    });
  }

  private async handleJoinFormSubmit(roomId: string, playerName: string): Promise<void> {
    try {
      this.showLoading(this.submitButton!, this.loadingSpinner!);

      // first join via HTTP to reserve spot
      this.gameRoomMetadata = await apiService.joinRoom(
        roomId,
        playerName,
        userIdentificationService.getId(),
      );

      // then establish socket connection
      socketService.connect();
      await socketService.joinRoom(roomId, userIdentificationService.getId(), playerName);

      // setup socket event handlers before loading view
      this.setupSocketEventHandlers();

      await this.loadView(UI_VIEW.JOIN_ROOM_VIEW);
      this.setupJoinRoomView();
    } catch (error) {
      console.error("Error joining game:", error);
      if (this.isAxiosError(error) && error.response?.data) {
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
  }

  private setupSocketEventHandlers(): void {
    // handle room state update
    socketService.onRoomState((data: GameRoomMetadata) => {
      if (!this.gameRoomMetadata) return;

      try {
        this.gameRoomMetadata = data;

        const playersGridElement = document.getElementById("players-grid");
        if (playersGridElement) {
          this.updatePlayersGrid(playersGridElement, this.gameRoomMetadata.players);
        }

        this.updateGamePlayerList(this.gameRoomMetadata.players);
      } catch (error) {
        console.error("Error updating room state:", error);
      }
    });

    // handle socket errors
    socketService.onError(({ message }) => {
      Toastify.default({
        text: message,
        duration: 3000,
        close: true,
        gravity: "top",
        position: "right",
        style: {
          background: "rgb(239 68 68)", // red
        },
      }).showToast();
    });

    // handle player joined
    socketService.onPlayerJoined((data) => {
      if (!this.gameRoomMetadata) return;

      const playersGridElement = document.getElementById("players-grid");
      if (playersGridElement) {
        const updatedPlayers = [...this.gameRoomMetadata.players];
        const playerIndex = updatedPlayers.findIndex((p) => p.id === data.userId);

        const newPlayerData: PlayerWithStatus = {
          id: data.userId,
          name: data.name,
          color: data.color,
          isHost: data.isHost,
          status: data.status === "active" ? PlayerStatus.Active : PlayerStatus.Inactive,
          lastStatusChange: data.lastStatusChange,
        };

        if (playerIndex === -1) {
          updatedPlayers.push(newPlayerData);
        } else {
          updatedPlayers[playerIndex] = {
            ...updatedPlayers[playerIndex],
            ...newPlayerData,
          };
        }

        this.gameRoomMetadata.players = updatedPlayers;
        this.updatePlayersGrid(playersGridElement, updatedPlayers);
        this.updateGamePlayerList(updatedPlayers);
      }
    });

    // handle player left
    socketService.onPlayerLeft((data) => {
      if (!this.gameRoomMetadata) return;

      const playersGridElement = document.getElementById("players-grid");
      if (playersGridElement) {
        const updatedPlayers = this.gameRoomMetadata.players.filter((p) => p.id !== data.userId);
        this.gameRoomMetadata.players = updatedPlayers;
        this.updatePlayersGrid(playersGridElement, updatedPlayers);
        this.updateGamePlayerList(updatedPlayers);
      }
    });

    // handle game started
    socketService.onGameStarted((gameRoomMetadata) => {
      this.startGame(gameRoomMetadata);
    });
  }

  private updateGamePlayerList(players: PlayerWithStatus[]): void {
    const playerListElement = document.getElementById("player-list");
    if (!playerListElement) {
      console.warn("player-list element not found");
      return;
    }

    // find the player entries container
    const playerEntriesContainer = playerListElement.querySelector(".player-entries");
    if (!playerEntriesContainer) {
      console.warn("player-entries container not found");
      return;
    }

    // clear existing entries
    playerEntriesContainer.innerHTML = "";

    // create and append player entries
    players.forEach((player) => {
      const playerElement = document.createElement("div");
      playerElement.className = "player-entry";

      const colorIndicator = document.createElement("div");
      colorIndicator.className = "player-color";
      colorIndicator.style.backgroundColor = player.color;

      const nameElement = document.createElement("span");
      nameElement.className = "player-name";
      nameElement.textContent = player.name;

      if (player.isHost) {
        const hostBadge = document.createElement("span");
        hostBadge.className = "host-badge";
        hostBadge.textContent = "Host";
        nameElement.appendChild(hostBadge);
      }

      playerElement.appendChild(colorIndicator);
      playerElement.appendChild(nameElement);
      playerEntriesContainer.appendChild(playerElement);
    });
  }

  private async startGame(gameRoomMetadata: GameRoomMetadata): Promise<void> {
    if (!this.gameRoomMetadata) return;
    this.gameRoomMetadata = gameRoomMetadata;
    this.hideModal();
    this.game.scene.start("Game", {
      roomMetadata: gameRoomMetadata,
      currentPlayerId: userIdentificationService.getId(),
    });
    this.updateGamePlayerList(gameRoomMetadata.players);
    this.showPatternSelection();
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
    if (!spinner) return;
    spinner.classList.remove("hidden");
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

  private setupModal(): void {
    this.modal = document.getElementById("modal");
    this.modalContent = document.getElementById("modal-content");
  }

  private async setup(): Promise<void> {
    if (!this.modal || !this.modalContent) {
      console.error("Required modal elements not found");
      return;
    }

    await this.loadView(UI_VIEW.CREATE_ROOM_VIEW);
    this.setupStartView();
  }

  private async loadView(viewName: string): Promise<void> {
    try {
      const html = await viewLoader.loadView(viewName);
      if (this.modalContent) {
        this.modalContent.innerHTML = html;
        createIcons({
          icons: {
            LoaderCircle,
            Copy,
            Check,
          },
        });

        if (viewName === UI_VIEW.JOIN_ROOM_VIEW) {
          this.setupJoinRoomView();
        }
      }
    } catch (error) {
      console.error("Error loading view:", error);
      this.showError("Failed to load view");
    }
  }

  private setupJoinRoomView(): void {
    if (!this.gameRoomMetadata) {
      console.error("Game room metadata is required");
      return;
    }

    const hostNameElement = document.getElementById("host-name");
    const roomLinkElement = document.getElementById("room-link");
    const playersGridElement = document.getElementById("players-grid");
    const copyLinkBtn = document.getElementById("copy-link-btn");
    const copyIcon = document.getElementById("copy-icon");
    const checkIcon = document.getElementById("check-icon");
    this.startGameBtn = document.getElementById("start-game-btn") as HTMLButtonElement;
    this.startGameSpinner = document.getElementById("start-game-spinner");

    // find host player
    const hostPlayer = this.gameRoomMetadata.players.find((p) => p.isHost);
    if (!hostPlayer) {
      console.error("Host player not found");
      return;
    }

    // update host name in title
    if (hostNameElement) {
      hostNameElement.textContent = hostPlayer.name;
    }

    // update room link and setup copy functionality
    if (roomLinkElement && copyLinkBtn && copyIcon && checkIcon) {
      const roomUrl = new URL(window.location.origin);
      roomUrl.pathname = `/r/${this.gameRoomMetadata.id}`;
      window.history.replaceState({}, "", roomUrl.toString());
      roomLinkElement.textContent = roomUrl.toString();

      copyLinkBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(roomUrl.toString());
          copyIcon.classList.add("hidden");
          checkIcon.classList.remove("hidden");
          setTimeout(() => {
            copyIcon.classList.remove("hidden");
            checkIcon.classList.add("hidden");
          }, 2000);
        } catch (err) {
          console.error("Failed to copy room link:", err);
        }
      });
    }

    // setup players grid with initial players
    if (playersGridElement) {
      this.updatePlayersGrid(playersGridElement, this.gameRoomMetadata.players);
    }

    // setup start game button (only visible to host)
    if (this.startGameBtn && this.startGameSpinner) {
      const currentPlayer = this.findCurrentPlayer();
      const isHost = currentPlayer?.isHost ?? false;

      this.startGameBtn.style.display = isHost ? "inline-flex" : "none";
      if (isHost) {
        this.initializeLoadingSpinner(this.startGameSpinner);
        this.startGameBtn.addEventListener("click", this.handleStartGame.bind(this));
      }
    }
  }

  private updatePlayersGrid(gridElement: HTMLElement, players: PlayerWithStatus[]): void {
    gridElement.innerHTML = "";
    players.forEach((player) => {
      const playerElement = document.createElement("div");
      playerElement.className = "flex flex-col items-center space-y-2";

      const statusClass = player.status === PlayerStatus.Active ? "opacity-100" : "opacity-50";
      playerElement.innerHTML = `
        <div class="w-16 h-16 rounded-lg ${statusClass}" style="background-color: ${player.color}"></div>
        <p class="text-sm text-center truncate max-w-[120px]">
          ${player.name}${player.isHost ? " (Host)" : ""}
          ${player.status === PlayerStatus.Inactive ? " (Inactive)" : ""}
        </p>
      `;
      gridElement.appendChild(playerElement);
    });
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

      // first create room via HTTP
      this.gameRoomMetadata = await apiService.createRoom(
        this.hostName,
        userIdentificationService.getId(),
      );

      // then establish socket connection
      socketService.connect();

      // setup socket event handlers before joining room
      this.setupSocketEventHandlers();

      await socketService.joinRoom(
        this.gameRoomMetadata.id,
        userIdentificationService.getId(),
        this.hostName,
      );
      await this.loadView(UI_VIEW.JOIN_ROOM_VIEW);
    } catch (error) {
      console.error("Error creating game room:", error);

      if (this.isAxiosError(error) && error.response?.data) {
        try {
          const errorData = ErrorMessageSchema.parse(error.response.data);
          this.showError(errorData.message);
        } catch {
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

  private isAxiosError(error: unknown): error is AxiosError {
    return (error as AxiosError)?.isAxiosError === true;
  }

  private async handleStartGame(): Promise<void> {
    if (!this.startGameBtn || !this.startGameSpinner || !this.gameRoomMetadata) return;

    try {
      this.showLoading(this.startGameBtn, this.startGameSpinner);
      socketService.startGame(this.gameRoomMetadata.id);
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

  private showPatternSelection(): void {
    this.patternSelection = document.getElementById("pattern-selection");
    if (this.patternSelection) {
      this.patternSelection.classList.remove("hidden");
    }
  }
}
export default GameManager;
