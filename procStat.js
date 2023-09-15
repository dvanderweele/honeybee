const {
  readFileSync
} = require('fs');

function sample(){
  const raw = readFileSync(
    '/proc/stat', 
    'utf8'
  );
  const lines = raw.split(
    '\n'
  );
  for(let i = 0; i < lines.length; i++){
    const line = lines[i];
    if(
      line.startsWith(
        'cpu '
      )
    ){
      const {
        groups
      } = line.match(
        /^cpu  (?<all_user_cpu>[0-9]+) (?<all_nice_cpu>[0-9]+) (?<all_system_cpu>[0-9]+) (?<all_idle_cpu>[0-9]+) (?<all_io_wait_cpu>[0-9]+) (?<all_servicing_interrupts_cpu>[0-9]+) (?<all_servicing_soft_interrupts>[0-9]+) /
      );
      groups.all_user_cpu = Number(
        groups.all_user_cpu
      ) * (
        10_000_000
      )
      groups.all_nice_cpu = Number(
        groups.all_nice_cpu
      );
      groups.all_system_cpu = Number(
        groups.all_system_cpu
      );
      groups.all_idle_cpu = Number(
        groups.all_idle_cpu
      );
      groups.all_io_wait_cpu = Number(
        groups.all_io_wait_cpu
      );
      groups.all_servicing_interrupts_cpu = Number(
        groups.all_servicing_interrupts_cpu
      );
      groups.all_servicing_soft_interrupts = Number(
        groups.all_servicing_soft_interrupts
      );
      return groups;
    } 
  }
} 

module.exports = sample