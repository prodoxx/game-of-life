import { createId } from "@paralleldrive/cuid2";

const USER_ID_KEY = "gameOfLife:userId";

class UserIdentificationService {
  private userId: string;

  constructor() {
    this.userId = this.getUserId();
  }

  private getUserId(): string {
    const storedId = localStorage.getItem(USER_ID_KEY);
    if (storedId) {
      return storedId;
    }

    const newId = createId();
    localStorage.setItem(USER_ID_KEY, newId);
    return newId;
  }

  public getId(): string {
    return this.userId;
  }
}

const userIdentificationService = new UserIdentificationService();
export { userIdentificationService };
