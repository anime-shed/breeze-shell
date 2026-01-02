import * as shell from "mshell";
import { Button, Text, SimpleMarkdownRender } from "./components";
import { UpdateDataContext, NotificationContext, PluginSourceContext } from "./contexts";
import { useTranslation } from "./utils";
import { PLUGIN_SOURCES } from "./constants";
import { memo, useContext, useEffect, useState, useMemo } from "react";

const UpdatePage = memo(() => {
    const { updateData } = useContext(UpdateDataContext)!;
    const { setErrorMessage } = useContext(NotificationContext)!;
    const { currentPluginSource } = useContext(PluginSourceContext)!;
    const { t } = useTranslation();
    const current_version = useMemo(() => shell.breeze.version(), []);

    const [exist_old_file, set_exist_old_file] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    // Task 1.2.1: Add loading state for update checks
    const [isChecking, setIsChecking] = useState(false);

    // Task 1.2.5: Add error handling with graceful recovery
    useEffect(() => {
        const checkOldFile = () => {
            try {
                setIsChecking(true);
                const oldFileExists = shell.fs.exists(shell.breeze.data_directory() + '/shell_old.dll');
                set_exist_old_file(oldFileExists);
            } catch (error) {
                console.error('Error checking for old shell file:', error);
                set_exist_old_file(false);
                setErrorMessage(t('update.check_failed', { error: String(error) }));
            } finally {
                setIsChecking(false);
            }
        };

        checkOldFile();
    }, [t, setErrorMessage]);

    if (!updateData) {
        return <Text>{t("common.loading")}</Text>;
    }

    const remote_version = updateData.shell.version;

    // Task 1.2.2 & 1.2.3: Make updateShell function sync since fs.exists is synchronous
    const updateShell = () => {
        if (isUpdating) return;

        setIsUpdating(true);
        const shellPath = shell.breeze.data_directory() + '/shell.dll';
        const shellOldPath = shell.breeze.data_directory() + '/shell_old.dll';
        const url = PLUGIN_SOURCES[currentPluginSource] + updateData.shell.path;

        const downloadNewShell = () => {
            shell.network.download_async(url, shellPath, () => {
                shell.println(t('plugins.update_downloaded'));
                setIsUpdating(false);
                set_exist_old_file(true);
            }, e => {
                shell.println(t('plugins.update_failed', { error: String(e) }));
                setIsUpdating(false);
                setErrorMessage(t('plugins.update_failed', { error: String(e) }));
            });
        };

        try {
            // Task 1.2.3: Make file existence checks sync (fs.exists is synchronous)
            const shellExists = shell.fs.exists(shellPath);
            const oldShellExists = shell.fs.exists(shellOldPath);

            if (shellExists) {
                if (oldShellExists) {
                    try {
                        shell.fs.remove(shellOldPath);
                        shell.fs.rename(shellPath, shellOldPath);
                        downloadNewShell();
                    } catch (e) {
                        shell.println(t('plugins.update_failed', { error: String(e) }));
                        setIsUpdating(false);
                        setErrorMessage(t('plugins.update_failed', { error: String(e) }));
                    }
                } else {
                    shell.fs.rename(shellPath, shellOldPath);
                    downloadNewShell();
                }
            } else {
                downloadNewShell();
            }
        } catch (_e) {
            shell.println(t('plugins.update_failed', { error: String(_e) }));
            setIsUpdating(false);
            setErrorMessage(t('plugins.update_failed', { error: String(_e) }));
        }
    };

    return (
        <flex gap={20} flexGrow={1} alignItems="stretch">
            <Text fontSize={24}>{t("update.title")}</Text>

            {/* Task 1.2.4: Add progress indicator during update checks */}
            {isChecking && (
                <flex backgroundColor="rgba(0,0,0,0.1)" padding={10} borderRadius={5} alignItems="center">
                    <Text fontSize={14}>{t("update.checking")}</Text>
                </flex>
            )}

            {!isChecking && (
                <flex gap={10}>
                    <Text>{t("update.current_version", { version: current_version })}</Text>
                    <Text>{t("update.latest_version", { version: remote_version })}</Text>
                    <Button
                        onClick={current_version === remote_version || isUpdating ? () => { } : updateShell}
                        disabled={isUpdating}
                    >
                        <Text>{
                            isUpdating ? t("plugins.updating") :
                                exist_old_file ? t("plugins.update_downloaded") : (current_version === remote_version ? (current_version + ' ' + t('common.latest')) : `${current_version} -> ${remote_version}`)}</Text>
                    </Button>
                </flex>
            )}

            <flex gap={10} flexGrow={1} alignItems="stretch">
                <Text>{t("update.changelog")}</Text>
                <flex enableScrolling={true} flexGrow={1} gap={10} alignItems="stretch">
                    <SimpleMarkdownRender text={updateData.shell.changelog} maxWidth={-1} />
                </flex>
            </flex>
        </flex>
    );
});

export default UpdatePage;