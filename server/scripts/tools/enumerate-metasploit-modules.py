#!/usr/bin/env python3
"""
Metasploit Module Enumeration Script
Enumerates all Metasploit modules and filters them based on requirements:
- ALL encoder, evasion, nop, post modules
- Top 50 auxiliary modules by service/protocol
- Top 10 technologies for exploit/payload modules
"""

import json
import subprocess
import re
from collections import defaultdict
from typing import Dict, List, Any

# Top 10 technology/platform keywords for exploit/payload filtering
TOP_TECHNOLOGIES = [
    'windows', 'linux', 'unix', 'macos', 'osx', 
    'apache', 'iis', 'php', 'java', 'python',
    'ssh', 'smb', 'rdp', 'http', 'https'
]

# Top 50 service/protocol keywords for auxiliary filtering
TOP_SERVICES = [
    'http', 'https', 'smb', 'ssh', 'ftp', 'telnet', 'smtp', 'pop3', 'imap',
    'dns', 'snmp', 'ldap', 'mysql', 'mssql', 'postgres', 'oracle', 'mongodb',
    'redis', 'memcached', 'vnc', 'rdp', 'nfs', 'rsync', 'rpc', 'tftp',
    'sip', 'rtsp', 'socks', 'proxy', 'ssl', 'tls', 'ipsec', 'vpn',
    'docker', 'kubernetes', 'jenkins', 'gitlab', 'jboss', 'tomcat', 'weblogic',
    'elasticsearch', 'kibana', 'splunk', 'grafana', 'prometheus', 'netbios',
    'kerberos', 'winrm', 'wmi', 'powershell'
]


def run_msfconsole_command(command: str) -> str:
    """Execute msfconsole command and return output"""
    try:
        cmd = ['msfconsole', '-q', '-x', f'{command}; exit']
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300
        )
        return result.stdout
    except subprocess.TimeoutExpired:
        print(f"Command timed out: {command}")
        return ""
    except Exception as e:
        print(f"Error running command: {e}")
        return ""


def parse_module_list(output: str, module_type: str) -> List[str]:
    """Parse msfconsole output to extract module paths"""
    modules = []
    lines = output.split('\n')
    
    for line in lines:
        line = line.strip()
        # Skip header lines, empty lines, and status messages
        if not line or line.startswith('=') or line.startswith('['):
            continue
        if 'Matching Modules' in line or 'Name' in line or '----' in line:
            continue
            
        # Extract module path (first column)
        parts = line.split()
        if parts and '/' in parts[0]:
            module_path = parts[0]
            # Remove module type prefix if present
            if module_path.startswith(f'{module_type}/'):
                module_path = module_path[len(module_type)+1:]
            modules.append(module_path)
    
    return modules


def get_module_info(module_type: str, module_path: str) -> Dict[str, Any]:
    """Get detailed information about a specific module"""
    full_path = f"{module_type}/{module_path}"
    output = run_msfconsole_command(f"info {full_path}")
    
    info = {
        'path': module_path,
        'name': '',
        'description': '',
        'rank': '',
        'platform': [],
        'targets': [],
        'options': [],
        'payloads': []
    }
    
    # Parse the output
    lines = output.split('\n')
    current_section = None
    
    for line in lines:
        line = line.strip()
        
        # Extract name
        if line.startswith('Name:'):
            info['name'] = line.replace('Name:', '').strip()
        
        # Extract description
        elif 'Description:' in line:
            current_section = 'description'
        elif current_section == 'description' and line and not line.startswith('Module'):
            info['description'] = line
            current_section = None
        
        # Extract rank
        elif 'Rank:' in line:
            rank_match = re.search(r'Rank:\s+(\w+)', line)
            if rank_match:
                info['rank'] = rank_match.group(1).lower()
        
        # Extract platform
        elif 'Platform:' in line or 'Available targets:' in line:
            # Extract platform/target info
            parts = line.split(':')
            if len(parts) > 1:
                platforms = parts[1].strip().split(',')
                info['platform'].extend([p.strip() for p in platforms if p.strip()])
    
    return info


def filter_exploits_payloads(modules: List[str]) -> List[str]:
    """Filter exploit/payload modules by top 10 technologies"""
    filtered = []
    for module in modules:
        module_lower = module.lower()
        if any(tech in module_lower for tech in TOP_TECHNOLOGIES):
            filtered.append(module)
    return filtered


def filter_auxiliary(modules: List[str]) -> List[str]:
    """Filter auxiliary modules by top 50 services"""
    filtered = []
    for module in modules:
        module_lower = module.lower()
        if any(service in module_lower for service in TOP_SERVICES):
            filtered.append(module)
    
    # Limit to top 50 if more found
    return filtered[:50] if len(filtered) > 50 else filtered


def organize_modules_by_category(modules: List[str]) -> Dict[str, List[str]]:
    """Organize modules by their category (first path component)"""
    organized = defaultdict(list)
    
    for module in modules:
        parts = module.split('/')
        if len(parts) > 1:
            category = parts[0]
            organized[category].append(module)
        else:
            organized['other'].append(module)
    
    return dict(organized)


def enumerate_all_modules() -> Dict[str, Any]:
    """Enumerate all Metasploit modules with filtering"""
    print("Starting Metasploit module enumeration...")
    
    result = {
        'metadata': {
            'generated_at': None,
            'total_modules': 0,
            'by_type': {}
        },
        'modules': {}
    }
    
    module_types = ['encoder', 'evasion', 'nop', 'post', 'exploit', 'payload', 'auxiliary']
    
    for module_type in module_types:
        print(f"\nEnumerating {module_type} modules...")
        
        # Get all modules of this type
        output = run_msfconsole_command(f"search type:{module_type}")
        modules = parse_module_list(output, module_type)
        
        print(f"Found {len(modules)} {module_type} modules")
        
        # Apply filtering
        if module_type in ['exploit', 'payload']:
            modules = filter_exploits_payloads(modules)
            print(f"Filtered to {len(modules)} {module_type} modules (top technologies)")
        elif module_type == 'auxiliary':
            modules = filter_auxiliary(modules)
            print(f"Filtered to {len(modules)} {module_type} modules (top services)")
        # encoder, evasion, nop, post - keep all
        
        # Organize by category
        organized = organize_modules_by_category(modules)
        
        result['modules'][module_type] = organized
        result['metadata']['by_type'][module_type] = len(modules)
        result['metadata']['total_modules'] += len(modules)
    
    # Add timestamp
    from datetime import datetime
    result['metadata']['generated_at'] = datetime.utcnow().isoformat() + 'Z'
    
    return result


def main():
    """Main execution"""
    print("Metasploit Module Enumeration Script")
    print("=" * 50)
    
    # Enumerate modules
    modules_data = enumerate_all_modules()
    
    # Write to JSON file
    output_path = '/app/server/data/metasploit-modules.json'
    
    print(f"\nWriting results to {output_path}...")
    try:
        with open(output_path, 'w') as f:
            json.dump(modules_data, f, indent=2)
        print(f"✓ Successfully wrote {modules_data['metadata']['total_modules']} modules")
        print("\nModules by type:")
        for module_type, count in modules_data['metadata']['by_type'].items():
            print(f"  - {module_type}: {count}")
    except Exception as e:
        print(f"✗ Error writing file: {e}")
        return 1
    
    return 0


if __name__ == '__main__':
    exit(main())
