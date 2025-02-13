import axios from "axios";

/**
 * service for loading html view templates
 */
class ViewLoader {
  public async loadView(viewName: string): Promise<string> {
    const response = await axios.get<string>(`/src/views/${viewName}.html`);
    return response.data;
  }
}

const viewLoader = new ViewLoader();
export { viewLoader };
