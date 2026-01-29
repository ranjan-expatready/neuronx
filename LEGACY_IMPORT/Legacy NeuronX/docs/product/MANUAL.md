# NeuronX Operator Manual

## 1. Routing Policy Management

The **Routing Policy Editor** allows Tenant Administrators and Operators to configure how leads are routed to sales teams based on geographic regions. This tool replaces the need for manual YAML configuration edits.

### Accessing the Editor
1.  Log in to the **NeuronX Control Plane** (Operator UI).
2.  Navigate to the **Routing** tab in the top navigation bar.
    *   *Note: This tab is visible only to users with `TenantAdmin` or `Operator` roles.*

### Managing Geographic Preferences
The editor displays a list of currently configured regions and their assigned teams.

#### Adding a New Rule
1.  Scroll to the "Add New Rule" section at the bottom of the list.
2.  Enter the **Region** code (e.g., `north-america`, `europe`).
3.  Enter the **Team ID** (e.g., `team-enterprise`, `team-global`).
4.  Click **Add**.
5.  Click **Save Changes** at the top right to apply the configuration.

#### Removing a Rule
1.  Locate the rule you wish to remove.
2.  Click the **Remove** button next to the rule.
3.  Click **Save Changes** to apply.

#### Editing a Team Assignment
1.  Modify the Team ID in the input field for an existing region.
2.  Click **Save Changes**.

### Audit Logs
All changes made through the Routing Policy Editor are logged in the system audit log. Administrators can review these logs to track who made changes and when.
