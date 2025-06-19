macOS Bash Command Cheat Sheet

Note: macOS uses BSD-derived versions of many command-line utilities, which may differ slightly from the GNU versions commonly found on Linux. Key differences are noted below. For GNU behavior, consider installing coreutils via Homebrew (brew install coreutils), which provides commands prefixed with g (e.g., gls, gsed).
Installation: Some useful commands like htop and wget might not be installed by default. Use a package manager like Homebrew (brew install <package_name>) to install them.
1. File System Navigation & Manipulation

ls: List directory contents.

-l: Long listing format (permissions, owner, size, date).
-a: List all files, including hidden ones (starting with .).
-h: Human-readable file sizes (used with -l).
-t: Sort by modification time, newest first.
-R: Recursively list subdirectories.
-G: Enable colorized output (macOS default in Terminal).
Example: ls -alh: List all files, including hidden, in long format with human-readable sizes.
Example: ls -lt: List files sorted by modification date.
cd: Change directory.

cd <directory_path>: Change to the specified directory.
cd ..: Move up one directory level.
cd ~ or cd: Change to the home directory.
cd -: Change to the previous working directory.
cd .: Refers to the current directory.
Example: cd ~/Documents: Change to the Documents folder in the home directory.
Example: cd ../Projects: Move up one level and then into the Projects directory.
pwd: Print working directory (shows the current directory path).

Example: pwd
cp: Copy files and directories.

-r or -R: Recursive copy (for directories). Note: On macOS/BSD, cp -R source/ dest copies the contents of source, while cp -R source dest copies the source directory itself into dest.
-p: Preserve attributes (modification time, ownership, permissions).
-v: Verbose - show files as they are copied.
-i: Interactive - prompt before overwriting.
Example: cp report.txt report_backup.txt: Copy a file.
Example: cp -R ./myFolder ~/Backups/: Recursively copy myFolder into the ~/Backups directory.
Example: cp -vp important.doc /Volumes/ExternalDrive/: Copy important.doc preserving attributes and showing progress.
mv: Move or rename files and directories.

-v: Verbose - show files as they are moved.
-i: Interactive - prompt before overwriting.
Example: mv old_name.txt new_name.txt: Rename a file.
Example: mv report.pdf ~/Documents/: Move report.pdf to the Documents directory.
Example: mv ./data ./archive/data_backup: Move the data directory into archive and rename it.
rm: Remove (delete) files. Use with caution!

-f: Force removal without prompting.
-i: Interactive - prompt before each removal.
-r or -R: Recursive removal (for directories and their contents). Extremely dangerous combined with -f.
-v: Verbose - show files as they are removed.
Example: rm temp_file.txt: Delete a file.
Example: rm -i *.log: Interactively delete all files ending in .log.
Example: rm -rf ./old_project: Forcefully and recursively delete the old_project directory and all its contents without confirmation.
rmdir: Remove empty directories.

Example: rmdir empty_folder
mkdir: Create directories.

-p: Create parent directories as needed (no error if directory exists).
-v: Verbose - print a message for each created directory.
Example: mkdir new_directory
Example: mkdir -p Projects/data/raw: Create Projects, data, and raw if they don't exist.
touch: Create an empty file or update file timestamps.

touch <filename>: Creates filename if it doesn't exist, or updates its access and modification times to now if it does.
-a: Change only the access time.
-m: Change only the modification time.
-t [[CC]YY]MMDDhhmm[.ss]: Set access and modification times to the specified timestamp.
Example: touch new_empty_file.md
Example: touch -m existing_file.txt: Update modification time of existing_file.txt.
Example: touch -t 202301151030 existing_file.txt: Set timestamp to Jan 15, 2023, 10:30 AM.
Note: To change the creation date, you might need Xcode Command Line Tools installed and use setfile -d 'MM/DD/YYYY hh:mm:ss' <filename>.
ln: Create links between files.

-s: Create a symbolic (soft) link. This points to the path of the original file. If the original is moved/deleted, the link breaks. (Most common type).
(Default): Create a hard link. This points to the same underlying data (inode) as the original file. Deleting the original doesn't affect the hard link. Hard links cannot span across different filesystems (disks/partitions) and usually cannot link to directories.
Syntax: ln [-s] <target_file> <link_name>
Example: ln -s /Applications/Calculator.app ~/Desktop/CalculatorLink: Create a symbolic link to Calculator on the Desktop.
Example: ln important_data.txt data_hardlink.txt: Create a hard link.
find: Search for files in a directory hierarchy.

<path>: Directory to start searching from (e.g., .).
-name <pattern>: Find files by name (use quotes for wildcards: *.txt). Case sensitive.
-iname <pattern>: Like -name, but case insensitive.
-type <f|d|l>: Find by type (file, directory, symbolic link).
-mtime <-days|+days|days>: Find files modified less than, more than, or exactly days ago. -mmin for minutes.
-size <+|-|size[c|k|M|G]>: Find files larger than, smaller than, or exactly size. c=bytes, k=KB, M=MB, G=GB.
-exec <command> {} \;: Execute command on each found file. {} is replaced by the filename. \; terminates the command. Use + instead of \; for potentially better performance if the command accepts multiple files.
-print: Print the matched file path (often default behavior).
Example: find . -name "*.log" -type f: Find all files ending in .log in the current directory and subdirectories.
Example: find /Users/Shared -type f -size +100M: Find files larger than 100MB in /Users/Shared.
Example: find . -name "*.tmp" -exec rm {} \;: Find and remove all .tmp files.
Note: BSD find (macOS) may have different options/syntax than GNU find. For complex regex, GNU find (gfind if coreutils installed) might be easier.
2. Text Processing

grep: Search for patterns in text.

<pattern>: The text or regular expression to search for.
<file(s)>: File(s) to search within. Reads from standard input if no file is given.
-i: Case-insensitive search.
-v: Invert match (show lines that don't match).
-r or -R: Recursively search files in directories.
-l: List only filenames containing the pattern.
-c: Count matching lines.
-n: Show line numbers.
-E: Use extended regular expressions (allows |, +, ?, etc. without escaping). egrep is often a shortcut.
-w: Match whole words only.
Example: grep "error" logfile.log: Find lines containing "error".
Example: grep -i 'warning' /var/log/*: Search all files in /var/log for "warning", ignoring case.
Example: grep -rl "TODO" ./src: Recursively list filenames in ./src containing "TODO".
Example: ps aux | grep -v grep | grep 'httpd': Find 'httpd' processes (filtering out the grep command itself).
Note: BSD grep (macOS) has differences from GNU grep, especially with advanced regex (like Perl-compatible -P, which isn't typically available/works differently).
sed: Stream editor for filtering and transforming text.

's/<find_pattern>/<replace_string>/<flags>': Substitute command.
g: Global replace (all occurrences on a line, not just the first).
i: Case-insensitive matching (GNU sed specific, often not available/reliable on macOS sed).
-e <script>: Add a script/command to execute. Useful for multiple operations.
-i <extension>: Edit file in-place. Crucially on macOS/BSD, you must provide an extension for backup (e.g., -i '.bak') or an empty string (-i '') for no backup. GNU sed allows -i without an argument.
-n: Suppress automatic printing; use with p flag (s/.../.../p) to print only modified lines.
/pattern/d: Delete lines matching pattern.
Example: sed 's/apple/orange/g' input.txt: Replace all "apple" with "orange".
Example: sed -i '' 's/old_url/new_url/g' config.txt: Replace URLs in-place in config.txt (macOS syntax, no backup).
Example: sed '/^#/d' config.txt: Delete comment lines starting with #.
Example: cat data.txt | sed 's/ //g': Remove all spaces from the output of cat data.txt.
awk: Pattern scanning and processing language. Powerful for column-based data.

'{<program>}': The script to execute for each line of input.
$0: Represents the entire line.
$1, $2, etc.: Represent the 1st, 2nd, etc., field (column) on the line.
NF: Variable holding the Number of Fields on the current line. $NF is the last field.
-F <separator>: Specify the field separator (default is whitespace).
/pattern/ { <action> }: Perform action only on lines matching the pattern.
BEGIN { <action> }: Perform action before processing input.
END { <action> }: Perform action after processing all input.
Example: ls -l | awk '{print $9}': Print only the 9th column (filename) from ls -l output.
Example: awk -F':' '{print $1}' /etc/passwd: Print the first field (username) from the password file, using : as the separator.
Example: awk '$3 > 100 {print $0}' data.txt: Print lines where the 3rd field is greater than 100.
Example: awk '{ sum += $1 } END { print sum }' numbers.txt: Calculate the sum of the first column.
cat: Concatenate and display file contents.

-n: Number output lines.
-E: Display $ at the end of each line.
Example: cat file1.txt file2.txt: Display contents of file1.txt followed by file2.txt.
Example: cat file.txt: Display contents of file.txt.
Example: cat file1.txt file2.txt > combined.txt: Combine files into a new file.
Example: cat > newfile.txt: Create a new file by typing input (press Ctrl+D to save and exit).
less: View file contents one page at a time (more advanced than more).

Spacebar / f: Forward one page.
b: Backward one page.
Up/Down Arrows: Scroll line by line.
/pattern: Search forward for pattern. n for next match, N for previous.
?pattern: Search backward.
g: Go to the beginning of the file.
G: Go to the end of the file.
q: Quit.
Example: less long_log_file.log
more: View file contents one page at a time (basic pager).

Spacebar: Forward one page.
Enter: Forward one line.
q: Quit.
Example: more config_file.txt
head: Display the beginning (top lines) of a file.

-n <num>: Display the first num lines (default is 10).
Example: head -n 20 data.csv: Show the first 20 lines of data.csv.
Example: head /var/log/system.log: Show the first 10 lines of the system log.
tail: Display the end (last lines) of a file.

-n <num>: Display the last num lines (default is 10).
-f: Follow - output appended data as the file grows (useful for logs). Press Ctrl+C to exit.
-F: Follow filename - retry if the file is recreated/rotated.
Example: tail -n 50 error.log: Show the last 50 lines of error.log.
Example: tail -f /var/log/system.log: Watch the system log in real-time.
sort: Sort lines of text files.

-r: Reverse the result of comparisons.
-n: Numeric sort (treat lines as numbers).
-k <field>: Sort based on a specific field (column).
-t <separator>: Specify field separator (used with -k).
-u: Unique - output only the first of an equal sequence.
Example: sort names.txt: Sort lines alphabetically.
Example: sort -nr scores.txt: Sort scores numerically in descending order.
Example: ls -l | sort -k 5 -n: Sort ls -l output by the 5th field (size) numerically.
uniq: Report or omit repeated lines. Only works on adjacent lines (use sort first).

-c: Prefix lines by the number of occurrences.
-d: Only print duplicate lines, one for each group.
-u: Only print unique lines (those that are not repeated).
-i: Ignore case differences when comparing.
Example: sort access.log | uniq -c: Count occurrences of each unique line in access.log.
Example: sort names.txt | uniq -d: Show only names that appear more than once.
wc: Print newline, word, and byte counts for files.

-l: Print the newline counts.
-w: Print the word counts.
-c: Print the byte counts.
-m: Print the character counts (can differ from -c for multi-byte characters).
Example: wc report.txt: Show lines, words, and bytes in report.txt.
Example: wc -l *.txt: Count lines in all .txt files.
Example: ls /bin | wc -l: Count the number of files in /bin.
diff: Compare files line by line.

-u: Unified format (common for patches, includes context lines).
-i: Ignore case differences.
-w: Ignore whitespace differences.
-r: Recursively compare directories.
-y: Side-by-side output format.
Example: diff file1.txt file2.txt: Show differences between two files.
Example: diff -u old_config.conf new_config.conf: Show differences in unified format.
Example: diff -r project_v1/ project_v2/: Compare two directories recursively.
tr: Translate or delete characters.

tr <set1> <set2>: Translate characters from set1 to corresponding characters in set2.
-d: Delete characters in set1.
-s: Squeeze repeated characters listed in the last specified set.
Character sets can use ranges (a-z, 0-9) and classes ([:lower:], [:upper:], [:digit:], [:space:]).
Example: cat file.txt | tr 'a-z' 'A-Z': Convert file contents to uppercase.
Example: echo "Hello World" | tr -s ' ': Squeeze multiple spaces into single spaces -> "Hello World".
Example: cat file.txt | tr -d '\r': Delete carriage return characters (useful for DOS->Unix conversion).
cut: Remove sections from each line of files (fields/columns).

-d <delimiter>: Specify the field delimiter (default is TAB).
-f <list>: Select only these fields. list can be a number (1), range (1-3), or comma-separated (1,3,5).
-c <list>: Select only these character positions.
-b <list>: Select only these byte positions.
-s: Suppress lines with no delimiter characters (used with -d).
Example: cut -d ':' -f 1 /etc/passwd: Extract usernames (1st field) using ':' as delimiter.
Example: ls -l | cut -c 1-10: Extract the first 10 characters (permissions) from ls -l output.
Example: cut -f 2,4 data.csv -d ',': Extract the 2nd and 4th fields from a CSV file.
3. Process Management

ps: Report a snapshot of current processes.

aux: BSD style - show processes for all users (a), with user (u), including those without a controlling terminal (x). Very common on macOS. Output includes USER, PID, %CPU, %MEM, VSZ, RSS, TT, STAT, STARTED, TIME, COMMAND.
-ef: System V style - show every process (-e) in full format (-f). Also common. Output includes UID, PID, PPID, C, STIME, TTY, TIME, CMD.
-e: Select all processes.
-f: Full-format listing.
-l: Long format listing.
Example: ps aux: List all running processes with detailed info (common macOS usage).
Example: ps aux | grep 'firefox': Find processes related to Firefox.
top: Display dynamic real-time view of running processes.

Interactive command (press keys while running):
q: Quit.
h: Help.
k: Kill a process (prompts for PID and signal).
r: Renice (change priority) a process (prompts for PID and nice value).
o: Change sort order (prompts for field, e.g., cpu, mem).
M: Sort by memory usage.
P: Sort by CPU usage (default).
N: Sort by PID.
T: Sort by time.
Example: top: Start the interactive process viewer.
Example: top -o cpu: Start top sorted by CPU usage.
Example: top -u <username>: Show processes for a specific user.
htop: Interactive process viewer (more user-friendly than top).

Not installed by default. Install with brew install htop.
Provides color, scrolling, easier process selection/killing (F9 key), tree view (F5), setup (F2).
Example: htop (after installation).
kill: Send a signal to a process (usually to terminate). Requires PID.

-<signal>: Specify signal number or name.
-9 or -SIGKILL: Forceful kill. Uncatchable, use as last resort.
-15 or -SIGTERM: Default signal. Graceful termination request (allows cleanup).
-1 or -SIGHUP: Hangup signal. Often used to make daemons reload configuration.
-l: List signal names.
Example: kill 1234: Send SIGTERM (15) to process with PID 1234.
Example: kill -9 5678: Force kill process 5678.
Example: kill -HUP 3456: Send SIGHUP to process 3456.
killall: Kill processes by name. Use with caution as it kills all processes matching the name.

-u <user>: Kill processes belonging to a specific user.
-s <signal> or -<signal>: Send a specific signal (default is SIGTERM).
-I: Ignore case.
Example: killall Dock: Restart the Dock process.
Example: sudo killall -HUP mDNSResponder: Send HUP signal to mDNSResponder (useful for DNS cache flushing).
pgrep: Look up processes based on name and other attributes, prints PIDs.

-l: List the process name along with the PID.
-u <user>: Find processes by user.
-f: Match against full argument list (command line).
-x: Match exactly the process name.
Example: pgrep Dock: Get the PID of the Dock process.
Example: pgrep -u root loginwindow: Find loginwindow processes run by root.
pkill: Signal processes based on name and other attributes (like pgrep + kill).

Options similar to pgrep (-u, -f, -x).
Sends SIGTERM by default. Use -<signal> (e.g., -9) to send a different signal.
Example: pkill -f "stale_process": Kill processes matching "stale_process" in their command line.
Example: pkill -u <user> bad_app: Kill bad_app running under <user>.
jobs: List active jobs (background processes started in the current shell).

-l: List PIDs in addition to job numbers.
Example: jobs
bg: Resume a suspended job in the background.

%<job_id>: Specify job number (from jobs output).
Example: bg %1: Resume job number 1 in the background.
fg: Bring a job to the foreground.

%<job_id>: Specify job number.
Example: fg %1: Bring job number 1 to the foreground.
Ctrl+Z: Suspend the currently running foreground process. Use bg or fg to resume it.

4. System Information

uname: Print system information.

-a: Print all available information (Kernel name, hostname, kernel release/version, machine hardware name, processor type).
-s: Kernel name (e.g., Darwin).
-n: Network node hostname.
-r: Kernel release.
-v: Kernel version.
-m: Machine hardware name (e.g., x86_64, arm64).
Example: uname -a
hostname: Show or set the system's hostname.

Example: hostname (Show current hostname)
whoami: Print the effective user ID (current username).

Example: whoami
date: Print or set the system date and time.

+%<format>: Format the output. Common formats:
%Y: Year (e.g., 2023)
%m: Month (01-12)
%d: Day of month (01-31)
%H: Hour (00-23)
%M: Minute (00-59)
%S: Second (00-60)
%Z: Time zone
%F: Full date (%Y-%m-%d)
%T: Time (%H:%M:%S)
-u: Display UTC time.
Example: date
Example: date '+%Y-%m-%d %H:%M:%S'
Example: date -u
Note: macOS date syntax for setting the date or adjusting it (-v) differs from GNU date.
uptime: Tell how long the system has been running. Also shows load averages.

Example: uptime
df: Report file system disk space usage.

-h: Human-readable sizes (MB, GB).
-H: Human-readable sizes (powers of 1000).
-k: Sizes in kilobytes (default on macOS often 512-byte blocks).
-T: Include file system type.
-i: Display inode information instead of block usage.
<path>: Show usage for the filesystem containing path.
Example: df -h: Show usage for all mounted filesystems.
Example: df -h /: Show usage for the root filesystem.
du: Estimate file and directory space usage.

-h: Human-readable sizes.
-s: Display only a total for each argument (summary).
-d <depth>: Display an entry for directories depth deep. -d 0 is like -s.
-c: Display a grand total.
-a: Display entries for files as well as directories.
Example: du -sh ~/Documents: Show total size of the Documents directory.
Example: du -h -d 1 .: Show sizes of files and directories in the current directory (one level deep).
Example: du -h: Show usage for current directory and subdirectories.
sysctl: Get or set kernel state variables.

-n: Only print the variable's value, not its name.
-a: List all variables.
<variable_name>: The variable to query (e.g., kern.ostype, hw.model, hw.memsize).
Example: sysctl kern.ostype: Show kernel type (Darwin).
Example: sysctl -n hw.ncpu: Show number of CPUs.
Example: sysctl hw.memsize: Show physical memory size in bytes.
sw_vers: Print macOS version information (macOS specific).

(no args): Prints ProductName, ProductVersion, BuildVersion.
-productName: Print only the product name (e.g., macOS).
-productVersion: Print only the OS version (e.g., 14.4.1).
-buildVersion: Print only the build number (e.g., 23E224).
Example: sw_vers
system_profiler: Reports detailed system hardware and software configuration (macOS specific).

-listDataTypes: Show available data types.
<dataType>: Report only information for the specified type (e.g., SPHardwareDataType, SPSoftwareDataType, SPNetworkDataType).
-detailLevel <mini|basic|full>: Specify level of detail.
Example: system_profiler SPHardwareDataType: Show hardware overview.
Example: system_profiler SPSoftwareDataType: Show system software details.
Example: system_profiler -listDataTypes
diskutil: Command-line interface for Disk Utility functions (macOS specific). Use with caution for modifying operations.

list: List disks and partitions with identifiers (e.g., disk0s2).
info <device>: Get detailed information about a disk or volume (use identifier or mount point).
mount/unmount <device>: Mount/unmount a volume.
mountDisk/unmountDisk <disk>: Mount/unmount all volumes on a disk.
eject <disk>: Eject a removable disk.
verifyVolume <device>: Verify the structure of a volume.
repairVolume <device>: Repair a volume.
eraseDisk <format> <newName> <device>: Erase and format an entire disk. Destructive!
eraseVolume <format> <newName> <device>: Erase and format a specific volume. Destructive!
apfs list: List APFS containers and volumes.
Example: diskutil list: List all disks.
Example: diskutil info /: Get info about the root volume.
Example: diskutil mount disk1s2: Mount a specific volume.
launchctl: Interface with launchd to manage daemons and agents (macOS specific).

list: List loaded agents/daemons. Can pipe to grep to filter.
load <path/to/service.plist>: Load and start a service defined by a .plist file.
unload <path/to/service.plist>: Unload and stop a service.
start <service-label>: Start a loaded service by its label.
stop <service-label>: Stop a loaded service.
kickstart -k <service-target>: Force stop and restart a service (newer macOS versions). Service target format: system/com.example.daemon, gui/501/com.example.agent.
print <domain-target>: Get detailed info about a service or domain.
Example: launchctl list | grep apple: List loaded Apple services.
Example: sudo launchctl load /Library/LaunchDaemons/com.company.daemon.plist: Load a system daemon.
Example: launchctl unload ~/Library/LaunchAgents/com.user.agent.plist: Unload a user agent.
5. Networking

ping: Send ICMP ECHO_REQUEST packets to network hosts.

-c <count>: Stop after sending count packets.
-i <interval>: Wait interval seconds between sending packets.
-t <ttl>: Set Time To Live.
-s <packetsize>: Specify packet size.
Example: ping -c 5 google.com: Send 5 pings to google.com.
ifconfig: Configure or display network interface parameters. (Often used just for display on modern macOS, configuration preferred via networksetup or GUI).

<interface>: Specify interface (e.g., en0, en1, lo0).
up/down: Bring interface up or down.
Example: ifconfig en0: Display configuration for en0 (usually Wi-Fi or first Ethernet).
Example: ifconfig -a: Display all interfaces, including inactive ones.
netstat: Show network status (connections, routing tables, interface stats).

-a: Show all active connections and listening ports.
-n: Show numerical addresses and port numbers (no DNS/service lookup).
-r: Display the routing table.
-p <protocol>: Show connections for the specified protocol (e.g., tcp, udp).
-i: Show interface statistics.
-s: Show per-protocol statistics.
Example: netstat -an: Show all connections and listening ports numerically.
Example: netstat -nr: Show the routing table numerically.
Note: lsof -i is often a more informative replacement for viewing active connections/listeners on macOS.
lsof: List open files (can show network connections).

-i: List network files (connections).
-i :<port>: List processes using a specific port.
-i <tcp|udp>: List only TCP or UDP connections.
-i @<host>: List connections to/from a specific host.
-n: Do not resolve hostnames (faster).
-P: Do not resolve port names (show numbers).
Example: sudo lsof -i :80: Show processes using port 80.
Example: sudo lsof -iTCP -sTCP:LISTEN -n -P: List processes listening on TCP ports (numeric).
Example: lsof -i @192.168.1.100: List connections involving IP 192.168.1.100.
ssh: Secure Shell client - connect to remote hosts securely.

<user>@<hostname>: User and host to connect to.
-p <port>: Connect to a non-standard port.
-i <identity_file>: Use a specific private key file.
-v: Verbose output (useful for debugging).
-L <local_port>:<remote_host>:<remote_port>: Local port forwarding.
-R <remote_port>:<local_host>:<local_port>: Remote port forwarding.
Example: ssh user@example.com: Connect as user to example.com.
Example: ssh -i ~/.ssh/id_rsa_personal user@server.net -p 2222: Connect using a specific key and port.
scp: Secure copy - transfer files over SSH.

-r: Recursively copy directories.
-P <port>: (Uppercase P) Specify port if non-standard.
-i <identity_file>: Use a specific private key file.
-p: Preserves modification times, access times, and modes.
-v: Verbose output.
Syntax: scp [-rPpi] source [...] user@host:destination or scp [-rPpi] user@host:source [...] destination
Example: scp local_file.txt user@remote.com:/path/to/remote/: Copy local file to remote.
Example: scp user@remote.com:/path/remote_file.zip .: Copy remote file to current local directory.
Example: scp -r local_dir user@remote.com:~/backups/: Recursively copy local directory to remote home backups folder.
curl: Transfer data from or to a server (supports HTTP, HTTPS, FTP, etc.).

-O: Write output to a local file named like the remote file.
-o <filename>: Write output to specified filename.
-L: Follow redirects (HTTP 3xx).
-I: Show response headers only (HEAD request).
-X <METHOD>: Specify request method (e.g., GET, POST, PUT, DELETE).
-d <data>: Send data in a POST request.
-H <header>: Pass custom header (e.g., -H "Content-Type: application/json").
-u <user:password>: Specify user and password for server authentication.
Example: curl https://example.com: Display content of the URL.
Example: curl -O https://example.com/file.zip: Download file.zip.
Example: curl -L https://short.url/resource -o output.html: Follow redirects and save final content.
Example: curl -X POST -d "param1=value1" https://api.example.com/submit: Send POST data.
wget: Non-interactive network downloader.

Not installed by default. Install with brew install wget.
-O <filename>: Save to specified filename.
-c: Continue partially downloaded file.
-r: Recursive download (for websites).
-np: No parent - don't ascend to parent directory when downloading recursively.
--user=<user> --password=<pass>: Specify authentication.
Example: wget https://example.com/archive.tar.gz: Download file.
Example: wget -r -np https://example.com/docs/: Recursively download files from a directory.
dig: DNS lookup utility (detailed).

@<server>: Query a specific DNS server.
<domain>: The domain name to query.
<type>: Record type (e.g., A, MX, NS, TXT, ANY).
+short: Provide brief output.
+trace: Show the full delegation path from root servers.
+nocmd: Omit command line and version info.
-x <ip_address>: Reverse DNS lookup.
Example: dig example.com A: Get A records for example.com.
Example: dig @8.8.8.8 example.com MX +short: Get MX records from Google DNS, short format.
Example: dig -x 192.0.2.1: Perform reverse lookup for IP address.
host: Simple utility for DNS lookups.

<domain>: Domain to look up.
<server>: Optional DNS server to query.
-t <type>: Specify query type (A, MX, NS, etc.).
Example: host example.com: Look up A, AAAA, and MX records.
Example: host -t NS example.com: Find name servers for example.com.
traceroute: Print the route packets take to network host.

<host>: The destination host or IP address.
-n: Do not resolve IP addresses to hostnames.
-q <nqueries>: Set number of probes per hop (default 3).
-w <waittime>: Set time to wait for response (seconds).
Example: traceroute google.com
6. Permissions & Execution

chmod: Change file modes or Access Control Lists.

Symbolic Mode: [ugoa][+-=][rwx]
u=user(owner), g=group, o=other, a=all
+=add permission, -=remove, ==set exact permission
r=read, w=write, x=execute
Octal Mode: Three digits (owner, group, other). Each digit is sum of: 4(read), 2(write), 1(execute).
7: rwx (4+2+1)
6: rw- (4+2+0)
5: r-x (4+0+1)
4: r-- (4+0+0)
0: --- (0+0+0)
-R: Recursive - apply changes to directories and their contents.
Example: chmod u+x script.sh: Make script executable for the owner.
Example: chmod 755 script.sh: Set permissions to rwxr-xr-x. (Owner: rwx, Group: r-x, Other: r-x). Common for scripts.
Example: chmod 644 data.txt: Set permissions to rw-r--r--. (Owner: rw, Group: r, Other: r). Common for data files.
Example: chmod -R go-w ./shared_folder: Recursively remove write permission for group and others in shared_folder.
chown: Change file owner and/or group. Requires sudo if not owner.

<user>[:<group>]: New owner and optional group (use : or . as separator).
-R: Recursive - apply changes to directories and their contents.
-h: Change ownership of symbolic links themselves, not their targets.
Example: sudo chown alice report.txt: Change owner of report.txt to alice.
Example: sudo chown bob:staff project_files/: Change owner to bob and group to staff for project_files.
Example: sudo chown -R www-data:www-data /var/www/html: Recursively change owner/group for web server files.
chgrp: Change group ownership. Requires sudo if not owner and not member of target group.

<group>: New group name.
-R: Recursive.
-h: Change group of symbolic links themselves.
Example: sudo chgrp admin config.conf: Change group of config.conf to admin.
Example: sudo chgrp -R developers ./src: Recursively change group ownership for ./src directory.
sudo: Execute a command as another user (typically the superuser, root).

Prompts for your (the invoking user's) password, if you are an administrator.
-i or -s: Start an interactive shell as root. -i simulates a full root login, -s runs a shell with root privileges but keeps some of the original user's environment.
-u <user>: Run command as a specified user other than root.
-k: Invalidate the cached credentials (force password prompt next time).
!!: sudo !! re-runs the previous command with sudo.
Example: sudo nano /etc/hosts: Edit the hosts file (requires root).
Example: sudo -i: Start a root login shell.
7. Other Useful Commands

history: Display command history list.

history <n>: Show last n commands.
!!: Re-run the last command.
!<n>: Re-run command number n from history.
!<string>: Re-run the last command starting with string.
Ctrl+R: Reverse interactive search through history.
Example: history
Example: history 10
Example: !150: Execute command 150 from history.
alias: Create command shortcuts.

alias <name>='<command>': Define an alias. Use quotes for commands with spaces or special characters.
alias: List all defined aliases.
Persistence: Add alias definitions to your shell config file (~/.zshrc for Zsh (default on newer macOS), ~/.bash_profile or ~/.bashrc for Bash) and run source <config_file> or open a new terminal tab.
Example: alias ll='ls -alh'
Example: alias update='sudo softwareupdate -ia --verbose'
unalias: Remove aliases.

unalias <name>
Example: unalias ll
export: Set environment variables for the current shell and its children.

export <VARNAME>=<value>
Persistence: Add export commands to your shell config file (~/.zshrc, ~/.bash_profile).
Example: export EDITOR=nano
Example: export PATH="/usr/local/bin:$PATH"
echo: Display a line of text or variable value.

-n: Do not output the trailing newline.
-e: Enable interpretation of backslash escapes (\n, \t, \\, etc.).
Example: echo "Hello, World!"
Example: echo $USER: Display the value of the USER variable.
Example: echo "Path is: $PATH"
Example: echo "Line1\nLine2" > file.txt (Bash/Zsh often interpret \n directly in double quotes)
Example: echo -e "Column1\tColumn2" (Use -e for explicit interpretation)
man: Display the on-line manual pages (documentation) for commands.

man <command>
Press Space to scroll down, b to scroll up, q to quit.
/pattern: Search within the man page.
Example: man ls
Example: man ssh_config
tar: Manipulate tape archives. Commonly used for creating/extracting .tar, .tar.gz, .tar.bz2 files.

-c: Create a new archive.
-x: Extract files from an archive.
-t: List the contents of an archive.
-v: Verbosely list files processed.
-f <filename>: Use archive file filename. Must usually be the last flag.
-z: Filter the archive through gzip (for .tar.gz or .tgz).
-j: Filter the archive through bzip2 (for .tar.bz2 or .tbz).
Example (Create): tar czvf archive.tar.gz ./directory_to_archive/: Create gzipped archive.
Example (Extract): tar xzvf archive.tar.gz: Extract gzipped archive into current directory.
Example (List): tar tzvf archive.tar.gz: List contents of gzipped archive.
Note: macOS tar (BSD) might auto-detect compression (-z/-j often not strictly needed for extraction if detected) but differs slightly from GNU tar.
gzip: Compress files (uses Lempel-Ziv coding, .gz extension).

<filename>: Compresses the file, replaces it with <filename>.gz.
-c: Write output to standard output, keep original file.
-d: Decompress (same as gunzip).
-k: Keep original file when compressing/decompressing.
Example: gzip large_file.log (results in large_file.log.gz)
Example: gzip -c data.txt > data.txt.gz
gunzip: Decompress files compressed by gzip.

<filename.gz>: Decompresses the file, replaces it with <filename>.
-c: Write output to standard output, keep compressed file.
-k: Keep compressed file after decompression.
Example: gunzip archive.tar.gz (results in archive.tar)
Example: gunzip -c data.txt.gz > data.txt
zip: Package and compress files (ZIP archive format).

<archive.zip>: Name of the archive to create/update.
<files...>: Files or directories to add.
-r: Recurse into directories.
-e: Encrypt contents (prompts for password).
Example: zip my_archive.zip file1.txt file2.jpg
Example: zip -r project_backup.zip ./project_folder/
unzip: List, test, and extract compressed files in a ZIP archive.

<archive.zip>: The archive to extract.
-d <directory>: Extract files into the specified directory.
-l: List archive contents without extracting.
Example: unzip documents.zip
Example: unzip photos.zip -d ./extracted_photos/
open: Open files, directories, and URLs with default or specified applications (macOS specific).

<path>: File or directory path.
<URL>: A web URL (http, https) or other URL scheme (mailto, ftp, etc.).
.: Open the current directory in Finder.
-a <Application>: Open with a specific application.
-e: Open with TextEdit.
-t: Open with the default text editor application.
-R: Reveal the item in Finder instead of opening it.
-g: Open the application in the background.
Example: open report.pdf
Example: open .
Example: open https://www.apple.com
Example: open -a "Google Chrome" https://google.com
Example: open -R ~/Downloads/myfile.zip
pbcopy: Copy data from standard input to the clipboard (macOS specific).

Example: cat report.txt | pbcopy: Copy the contents of report.txt to the clipboard.
Example: pwd | pbcopy: Copy the current directory path to the clipboard.
pbpaste: Paste data from the clipboard to standard output (macOS specific).

Example: pbpaste > clipboard_content.txt: Paste clipboard contents into a file.
Example: pbpaste | grep "keyword": Search the clipboard contents for "keyword".