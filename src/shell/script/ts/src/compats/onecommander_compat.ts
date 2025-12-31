import * as shell from "mshell";
import { t } from "../shared/i18n";
export const doOneCommanderCompat = () => {
    shell.menu_controller.add_menu_listener(m => {
        const do_action = (keys: string[]) => () => {
            m.menu.close();
            shell.infra.setTimeout(() => {
                shell.win32.simulate_hotkeys(keys);
            }, 50);
            shell.infra.setTimeout(() => {
                shell.win32.simulate_hotkeys(keys);
            }, 70);
            shell.infra.setTimeout(() => {
                shell.win32.simulate_hotkeys(keys);
            }, 100);
        }

        for (const i of m.menu.items) {
            const name = i.data().name;
            if (name === t("menu.rename") || name === "Rename" || name === "重命名") {
                i.set_data({
                    action: do_action(['f2'])
                })
            }
        }

        const fill = shell.breeze.is_light_theme() ? "fill=\"#000000\"" : "fill=\"#FFFFFF\"";
        const NEW_NAME = t("menu.new");
        const CREATE_FOLDER_NAME = t("menu.folder");
        const CREATE_FILE_NAME = t("menu.file");
        m.menu.append_item_after({
            name: NEW_NAME,
            submenu(m) {
                m.append_item({
                    name: CREATE_FOLDER_NAME,
                    action: do_action(['ctrl', 'shift', 'n']),
                    icon_svg: `<svg xmlns="http://www.w3.org/2000/svg" ${fill} viewBox="0 0 24 24"><path d="M10 4H2v16h20V6H12l-2-2z"/></svg>`
                })
                m.append_item({
                    name: CREATE_FILE_NAME,
                    action: do_action(['ctrl', 'n']),
                    icon_svg: `<svg xmlns="http://www.w3.org/2000/svg" ${fill} viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM13 3.5L18.5 9H13V3.5z"/></svg>`
                })
            }
        }, -2)
    })
}


