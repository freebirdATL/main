//__Write a program RollLoadedDie.java that prints the result of rolling a loaded die
// such that the probability of getting a 1, 2, 3, 4, or 5 is 1/8 and the
//  probability of getting a 6 is 3/8.
public class RollLoadedDie {
    public static void main(String[] args) {
        int[] arr = {0,0,0,0,0,0};
        int n = Integer.parseInt(args[0]);
        int die;

        for(int i = 0; i < n; i++){
            die = (int) (Math.random() * 8) + 1; //rand int [1,8]
            if(die < 6) {
                //System.out.print(die + ","); //roll of 1-5 will return roll
                arr[die-1]++;

            }
            else {
                //System.out.print(6 + ","); //roll 6-8 returns 6
                arr[6-1]++;
            }
        }

        for(int i = 0; i < 6; i++) {
            System.out.print(i+1 + ": count = " + arr[i] + ", pct = " + ((long)arr[i] * 100 / n ) + "%\n");
        }
    }
}