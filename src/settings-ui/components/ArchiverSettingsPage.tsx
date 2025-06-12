import { For, Show } from "solid-js";

import { Cog } from "./Cog";
import { DateFormatDescription } from "./DateFormatDescription";
import { HeadingTreeDemo } from "./HeadingTreeDemo";
import { HeadingsSettings } from "./HeadingsSettings";
import { ListItemTreeDemo } from "./ListItemTreeDemo";
import { ListItemsSettings } from "./ListItemsSettings";
import { PlaceholdersDescription } from "./PlaceholdersDescription";
import { Rule } from "./Rule";
import { TaskPatternSettings } from "./TaskPatternSettings";
import { useSettingsContext } from "./context/SettingsProvider";
import { ButtonSetting } from "./setting/ButtonSetting";
import { DropDownSetting } from "./setting/DropDownSetting";
import { SettingGroup } from "./setting/SettingGroup";
import { TextAreaSetting } from "./setting/TextAreaSetting";
import { TextSetting } from "./setting/TextSetting";
import { ToggleSetting } from "./setting/ToggleSetting";

import { placeholders } from "../../Constants";
import { ArchiveFileType, TaskSortOrder } from "../../Settings";
import { PlaceholderService } from "../../services/PlaceholderService";
import { createDefaultRule } from "../../util/Util";

interface ArchiverSettingsPageProps {
  placeholderService: PlaceholderService;
}

export function ArchiverSettingsPage(props: ArchiverSettingsPageProps) {
  const [settings, setSettings] = useSettingsContext();

  const replacementResult = () =>
    settings.textReplacement.replacementTest.replace(
      new RegExp(settings.textReplacement.regex),
      settings.textReplacement.replacement
    );

  return (
    <>
      <h1>Archiver Settings</h1>

      <DropDownSetting
        onInput={({ currentTarget: { value } }) => {
          // todo: handle this without an assertion?
          const asserted = value as TaskSortOrder;
          setSettings("taskSortOrder", asserted);
        }}
        name="Order archived tasks"
        options={[TaskSortOrder.NEWEST_LAST, TaskSortOrder.NEWEST_FIRST]}
        value={settings.taskSortOrder}
      />

      <ToggleSetting
        onClick={() => setSettings("sortAlphabetically", (prev) => !prev)}
        name="Sort top-level tasks alphabetically before archiving"
        value={settings.sortAlphabetically}
      />

      <ToggleSetting
        onClick={() => {
          setSettings("addNewlinesAroundHeadings", (prev) => !prev);
        }}
        name="Add newlines around the archive heading"
        value={settings.addNewlinesAroundHeadings}
      />

      <ToggleSetting
        name="Archive all checked tasks"
        description="Archive tasks with symbols other than 'x' (like '[>]', '[-]', etc.)"
        value={settings.archiveAllCheckedTaskTypes}
        onClick={() =>
          setSettings({
            archiveAllCheckedTaskTypes: !settings.archiveAllCheckedTaskTypes,
          })
        }
      />

      <ToggleSetting
        name="Archive a task only if its subtasks are done"
        value={settings.archiveOnlyIfSubtasksAreDone}
        onClick={() =>
          setSettings({
            archiveOnlyIfSubtasksAreDone: !settings.archiveOnlyIfSubtasksAreDone,
          })
        }
      />

      <TaskPatternSettings />

      <SettingGroup>
        <ToggleSetting
          name="Replace some text before archiving"
          description="You can use it to remove tags from your archived tasks. Note that this replacement is applied to all the list items in the completed task"
          onClick={() => {
            setSettings("textReplacement", "applyReplacement", (prev) => !prev);
          }}
          value={settings.textReplacement.applyReplacement}
        />
        <Show when={settings.textReplacement.applyReplacement} keyed>
          <TextSetting
            onInput={({ currentTarget: { value } }) => {
              setSettings("textReplacement", "regex", value);
            }}
            name="Regular expression"
            value={settings.textReplacement.regex}
          />
          <TextSetting
            onInput={({ currentTarget: { value } }) => {
              setSettings("textReplacement", "replacement", value);
            }}
            name="Replacement"
            value={settings.textReplacement.replacement}
          />
          <TextAreaSetting
            name="Try out your replacement"
            description={
              <>
                Replacement result: <b>{replacementResult()}</b>
              </>
            }
            onInput={({ currentTarget: { value } }) => {
              setSettings("textReplacement", "replacementTest", value);
            }}
            value={settings.textReplacement.replacementTest}
          />
        </Show>
      </SettingGroup>

      <SettingGroup>
        <ToggleSetting
          name="Archive to a separate file"
          description="If checked, the archiver will search for a file based on the pattern and will try to create it if needed"
          onClick={() => {
            setSettings({ archiveToSeparateFile: !settings.archiveToSeparateFile });
          }}
          value={settings.archiveToSeparateFile}
        />
        <Show when={settings.archiveToSeparateFile} keyed>
          <DropDownSetting
            name="What kind of file to use?"
            description={`If you pick "Daily note", your daily note template is going to be used when creating it`}
            options={[ArchiveFileType.CUSTOM, ArchiveFileType.DAILY]}
            value={settings.separateFileType}
            onInput={({ currentTarget: { value } }) => {
              setSettings({ separateFileType: value as ArchiveFileType });
            }}
          />

          <Show when={settings.separateFileType === ArchiveFileType.CUSTOM}>
            <TextAreaSetting
              onInput={({ currentTarget: { value } }) => {
                setSettings({ defaultArchiveFileName: value });
              }}
              name="File name"
              value={settings.defaultArchiveFileName}
            />

            <PlaceholdersDescription placeholderResolver={props.placeholderService} />

            <SettingGroup headerIcon={<Cog />} header="Configure variables" collapsible>
              <TextSetting
                onInput={({ currentTarget: { value } }) => {
                  setSettings({ dateFormat: value });
                }}
                name="Date format"
                description={<DateFormatDescription dateFormat={settings.dateFormat} />}
                value={settings.dateFormat}
              />
              <TextSetting
                onInput={({ currentTarget: { value } }) => {
                  setSettings({ obsidianTasksCompletedDateFormat: value });
                }}
                name="obsidian-tasks completed date format"
                description={
                  <DateFormatDescription
                    dateFormat={settings.obsidianTasksCompletedDateFormat}
                  />
                }
                value={settings.obsidianTasksCompletedDateFormat}
              />
            </SettingGroup>
          </Show>
        </Show>
      </SettingGroup>

      <SettingGroup>
        <ToggleSetting
          onClick={() => {
            setSettings("archiveUnderHeading", (prev) => !prev);
          }}
          name="Archive under headings"
          description="When disabled, no headings will get created"
          value={settings.archiveUnderHeading}
        />
        <Show when={settings.archiveUnderHeading} keyed>
          <DropDownSetting
            onInput={({ currentTarget: { value } }) => {
              setSettings({ archiveHeadingDepth: Number(value) });
            }}
            name="First heading depth"
            options={["1", "2", "3", "4", "5", "6"]}
            value={String(settings.archiveHeadingDepth)}
          />

          <ButtonSetting
            onClick={() => setSettings("headings", (prev) => [...prev, { text: "" }])}
            buttonText="Add heading"
          />

          <For each={settings.headings}>
            {(heading, index) => <HeadingsSettings heading={heading} index={index()} />}
          </For>

          <PlaceholdersDescription placeholderResolver={props.placeholderService} />

          <HeadingTreeDemo placeholderService={props.placeholderService} />
        </Show>
      </SettingGroup>

      <SettingGroup>
        <ToggleSetting
          onClick={() => {
            setSettings("archiveUnderListItems", (prev) => !prev);
          }}
          name="Archive under list items"
          value={settings.archiveUnderListItems}
        />

        <Show when={settings.archiveUnderListItems} keyed>
          <ButtonSetting
            onClick={() =>
              setSettings("listItems", (prev) => [
                ...prev,
                { text: `[[${placeholders.DATE}]]` },
              ])
            }
            buttonText="Add list level"
          />

          <For each={settings.listItems}>
            {(listItem, index) => (
              <ListItemsSettings listItem={listItem} index={index()} />
            )}
          </For>

          <PlaceholdersDescription placeholderResolver={props.placeholderService} />

          <ListItemTreeDemo placeholderService={props.placeholderService} />
        </Show>
      </SettingGroup>

      <SettingGroup>
        <ToggleSetting
          onClick={() => {
            setSettings(
              "additionalMetadataBeforeArchiving",
              "addMetadata",
              (prev) => !prev
            );
          }}
          name="Append some metadata to task before archiving"
          value={settings.additionalMetadataBeforeArchiving.addMetadata}
        />

        <Show when={settings.additionalMetadataBeforeArchiving.addMetadata} keyed>
          <TextSetting
            onInput={({ currentTarget: { value } }) => {
              setSettings("additionalMetadataBeforeArchiving", "metadata", value);
            }}
            name="Metadata to append"
            description={
              <>
                Current result:{" "}
                <code>
                  - [x] water the cat #task{" "}
                  {props.placeholderService.resolve(
                    settings.additionalMetadataBeforeArchiving.metadata,
                    {
                      dateFormat: settings.additionalMetadataBeforeArchiving.dateFormat,
                    }
                  )}
                </code>
              </>
            }
            value={settings.additionalMetadataBeforeArchiving.metadata}
            class="wide-input"
          />
          <TextSetting
            onInput={({ currentTarget: { value } }) => {
              setSettings(
                "additionalMetadataBeforeArchiving",
                "frontmatterKeys",
                value
              );
            }}
            name="Front matter keys"
            description="Comma separated keys from the note's front matter to add"
            value={settings.additionalMetadataBeforeArchiving.frontmatterKeys}
            class="wide-input"
          />
          <PlaceholdersDescription
            placeholderResolver={props.placeholderService}
            extraPlaceholders={[
              [
                placeholders.HEADING,
                "resolves to the closest heading above the task; defaults to file name",
              ],
              [
                placeholders.HEADING_CHAIN,
                "resolves to a chain of all the headings above the task; defaults to file name",
              ],
            ]}
          />
          <SettingGroup header="Configure variables" collapsible headerIcon={<Cog />}>
            <TextSetting
              onInput={({ currentTarget: { value } }) => {
                setSettings("additionalMetadataBeforeArchiving", "dateFormat", value);
              }}
              name="Date format"
              description={
                <DateFormatDescription
                  dateFormat={settings.additionalMetadataBeforeArchiving.dateFormat}
                />
              }
              value={settings.additionalMetadataBeforeArchiving.dateFormat}
            />
          </SettingGroup>
        </Show>
      </SettingGroup>

      <h2>Rules</h2>

      <ButtonSetting
        onClick={() =>
          setSettings("rules", (prev) => [
            ...prev,
            {
              ...createDefaultRule(settings),
              archiveToSeparateFile: true,
              defaultArchiveFileName: "",
            },
          ])
        }
        buttonText="Add rule"
        description="Define rules for handling tasks that match certain conditions"
      />
      <For each={settings.rules}>
        {(rule, index) => (
          <Rule index={index} placeholderResolver={props.placeholderService} />
        )}
      </For>
    </>
  );
}
