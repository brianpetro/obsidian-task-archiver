import { App, PluginSettingTab, Setting } from "obsidian";

import ObsidianTaskArchiver from "./ObsidianTaskArchiverPlugin";

export class ArchiverSettingTab extends PluginSettingTab {
    constructor(app: App, private plugin: ObsidianTaskArchiver) {
        super(app, plugin);
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName("Additional task pattern")
            .setDesc(
                "Only archive tasks matching this pattern, typically '#task' but can be anything."
            )
            .addText((textComponent) => {
                textComponent
                    .setValue(this.plugin.settings.additionalTaskPattern)
                    .onChange(async (value) => {
                        const validation =
                            containerEl.querySelector("#pattern-validation");
                        validation.setText(getPatternValidation(value));

                        this.plugin.settings.additionalTaskPattern = value;
                        await this.plugin.saveSettings();
                    });
            })
            .then((setting) => {
                setting.descEl.appendChild(
                    createFragment((fragment) => {
                        fragment.createEl("br");
                        fragment.createEl("b", {
                            text: getPatternValidation(
                                this.plugin.settings.additionalTaskPattern
                            ),
                            attr: {
                                id: "pattern-validation",
                            },
                        });
                    })
                );
            });

        new Setting(containerEl)
            .setName("Archive all checked tasks")
            .setDesc(
                "Archive tasks with symbols other than 'x' (like '[>]', '[-]', etc.)"
            )
            .addToggle((toggleComponent) => {
                toggleComponent
                    .setValue(this.plugin.settings.archiveAllCheckedTaskTypes)
                    .onChange(async (value) => {
                        this.plugin.settings.archiveAllCheckedTaskTypes = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName("Regex replacement during archiving")
            .setDesc("This replacement is going to be applied to every archived task")
            .addToggle((toggleComponent) => {
                toggleComponent
                    .setValue(this.plugin.settings.textReplacement.applyReplacement)
                    .onChange(async (value) => {
                        this.plugin.settings.textReplacement.applyReplacement = value;
                        await this.plugin.saveSettings();
                        this.display();
                    });
            });

        if (this.plugin.settings.textReplacement.applyReplacement) {
            new Setting(containerEl).setName("Regex:").addTextArea((component) => {
                component.setValue(this.plugin.settings.textReplacement.regex);
                component.onChange(async (value) => {
                    this.plugin.settings.textReplacement.regex = value;
                    await this.plugin.saveSettings();
                });
            });
            new Setting(containerEl)
                .setName("Replacement:")
                .addTextArea((component) => {
                    component.setValue(
                        this.plugin.settings.textReplacement.replacement
                    );
                    component.onChange(async (value) => {
                        this.plugin.settings.textReplacement.replacement = value;
                        await this.plugin.saveSettings();
                    });
                });

            new Setting(containerEl)
                .setName("Test out your regex here:")
                .addTextArea((component) => {
                    component.setPlaceholder("test out your regex");
                    component.setValue(
                        this.plugin.settings.textReplacement.replacementTest
                    );
                    component.onChange(async (value) => {
                        this.plugin.settings.textReplacement.replacementTest = value;
                        await this.plugin.saveSettings();
                    });
                });

            new Setting(containerEl).addButton((component) => {
                component.setButtonText("Apply regex").onClick(() => {
                    this.display();
                });
            });

            new Setting(containerEl)
                .setName("The replaced value looks like this:")
                .addTextArea((component) => {
                    const { regex, replacement, replacementTest } =
                        this.plugin.settings.textReplacement;
                    const replacementResult = replacementTest.replace(
                        new RegExp(regex),
                        replacement
                    );
                    component.setValue(replacementResult).setDisabled(true);
                });
        }

        containerEl.createEl("h2", { text: "Archive heading settings" });

        new Setting(containerEl)
            .setName("Archive heading text")
            .setDesc("A heading with this text will be used as an archive")
            .addText((textComponent) => {
                textComponent
                    .setPlaceholder(this.plugin.settings.archiveHeading)
                    .setValue(this.plugin.settings.archiveHeading)
                    .onChange(async (value) => {
                        this.plugin.settings.archiveHeading = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName("Add newlines around the archive")
            .setDesc("Add newlines around the contents of archive headings")
            .addToggle((toggleComponent) => {
                toggleComponent
                    .setValue(this.plugin.settings.addNewlinesAroundHeadings)
                    .onChange(async (value) => {
                        this.plugin.settings.addNewlinesAroundHeadings = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName("Depth of new archive headings")
            .setDesc("New archives will be created by repeating '#' this many times")
            .addDropdown((dropdownComponent) => {
                dropdownComponent
                    .addOptions({
                        "1": "1",
                        "2": "2",
                        "3": "3",
                        "4": "4",
                        "5": "5",
                        "6": "6",
                    })
                    .setValue(String(this.plugin.settings.archiveHeadingDepth))
                    .onChange(async (value) => {
                        this.plugin.settings.archiveHeadingDepth = Number(value);
                        await this.plugin.saveSettings();
                    });
            });

        containerEl.createEl("h2", { text: "Archive file settings" });

        new Setting(containerEl)
            .setName("Archive to a separate file")
            .setDesc(
                "If checked, the archiver will search for a file based on the pattern and will try to create it if needed"
            )
            .addToggle((toggleComponent) => {
                toggleComponent
                    .setValue(this.plugin.settings.archiveToSeparateFile)
                    .onChange(async (value) => {
                        this.plugin.settings.archiveToSeparateFile = value;
                        await this.plugin.saveSettings();
                        this.display();
                    });
            });

        if (this.plugin.settings.archiveToSeparateFile) {
            new Setting(containerEl)
                .setName("Separate archive file name")
                .setDesc(
                    "If archiving to a separate file is on, replace the '%' with the active file name and try to find a file with this base name"
                )
                .addText((textComponent) => {
                    textComponent
                        .setValue(this.plugin.settings.defaultArchiveFileName)
                        .onChange(async (value) => {
                            this.plugin.settings.defaultArchiveFileName = value;
                            await this.plugin.saveSettings();
                        });
                });
        }

        containerEl.createEl("h2", { text: "Date levels settings" });

        new Setting(containerEl)
            .setName("Use weeks")
            .setDesc("Add completed tasks under a link to the current week")
            .addToggle((toggleComponent) =>
                toggleComponent
                    .setValue(this.plugin.settings.useWeeks)
                    .onChange(async (value) => {
                        this.plugin.settings.useWeeks = value;
                        await this.plugin.saveSettings();
                        this.display();
                    })
            );

        if (this.plugin.settings.useWeeks) {
            new Setting(containerEl)
                .setDisabled(!this.plugin.settings.useWeeks)
                .setName("Weekly note pattern")
                .then((setting) => {
                    setting.addMomentFormat((momentFormat) => {
                        setting.descEl.appendChild(
                            createFragment((fragment) => {
                                fragment.appendText("For more syntax, refer to ");
                                fragment.createEl(
                                    "a",
                                    {
                                        text: "format reference",
                                        href: "https://momentjs.com/docs/#/displaying/format/",
                                    },
                                    (a) => {
                                        a.setAttr("target", "_blank");
                                    }
                                );
                                fragment.createEl("br");
                                fragment.appendText(
                                    "Your current syntax looks like this: "
                                );
                                momentFormat.setSampleEl(fragment.createEl("b"));
                                fragment.createEl("br");
                            })
                        );

                        momentFormat
                            .setDefaultFormat(this.plugin.settings.weeklyNoteFormat)
                            .setPlaceholder(this.plugin.settings.weeklyNoteFormat)
                            .setValue(this.plugin.settings.weeklyNoteFormat)
                            .onChange(async (value) => {
                                this.plugin.settings.weeklyNoteFormat = value;
                                await this.plugin.saveSettings();
                            });
                    });
                });
        }

        new Setting(containerEl)
            .setName("Use days")
            .setDesc("Add completed tasks under a link to the current day")
            .addToggle((toggleComponent) =>
                toggleComponent
                    .setValue(this.plugin.settings.useDays)
                    .onChange(async (value) => {
                        this.plugin.settings.useDays = value;
                        await this.plugin.saveSettings();
                        this.display();
                    })
            );

        if (this.plugin.settings.useDays) {
            new Setting(containerEl)
                .setDisabled(!this.plugin.settings.useDays)
                .setName("Daily note pattern")
                .then((setting) => {
                    setting.addMomentFormat((momentFormat) => {
                        setting.descEl.appendChild(
                            createFragment((fragment) => {
                                fragment.appendText("For more syntax, refer to ");
                                fragment.createEl(
                                    "a",
                                    {
                                        text: "format reference",
                                        href: "https://momentjs.com/docs/#/displaying/format/",
                                    },
                                    (a) => {
                                        a.setAttr("target", "_blank");
                                    }
                                );
                                fragment.createEl("br");
                                fragment.appendText(
                                    "Your current syntax looks like this: "
                                );
                                momentFormat.setSampleEl(fragment.createEl("b"));
                                fragment.createEl("br");
                            })
                        );

                        momentFormat
                            .setDefaultFormat(this.plugin.settings.dailyNoteFormat)
                            .setPlaceholder(this.plugin.settings.dailyNoteFormat)
                            .setValue(this.plugin.settings.dailyNoteFormat)
                            .onChange(async (value) => {
                                this.plugin.settings.dailyNoteFormat = value;
                                await this.plugin.saveSettings();
                            });
                    });
                });
        }
    }
}

function getPatternValidation(pattern: string) {
    return validatePattern(pattern)
        ? "✔️ The current pattern is valid"
        : "❌ The current pattern is invalid";
}

function validatePattern(pattern: string) {
    try {
        new RegExp(pattern);
        return true;
    } catch (e) {
        return false;
    }
}
