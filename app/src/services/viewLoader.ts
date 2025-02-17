import { templates, type TemplateName } from "../views/templates";

/**
 * service for loading html templates
 */
class ViewLoader {
  public async loadView(viewName: TemplateName): Promise<string> {
    return templates[viewName];
  }
}

const viewLoader = new ViewLoader();
export { viewLoader };
