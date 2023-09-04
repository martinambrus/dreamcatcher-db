import { IDatabase } from './Interfaces/IDatabase.js';
import { PrismaClient } from '@prisma/client';

/**
 * PostgreSQL database functionality implementation
 * via Prisma ORM.
 */
export class Database implements IDatabase {

  /**
   * Prisma DB client.
   * @private
   * @type { PrismaClient }
   */
  private client: PrismaClient;

  /**
   * Initializes the Prisma client.
   */
  constructor() {
    this.client = new PrismaClient();
  }

  /**
   * Retrieves all feeds that can be presently fetched
   * and polled for new links.
   */
  public async fetch_feeds(): Promise<{ records: Array<{ url: string }> }> {
    let feeds = await this.client.fetchable_feeds.findMany();
    return { records: feeds };
  }

  /**
   * Updates old (and wrong) URL for an RSS feed with a new (and valid) one.
   *
   * @param { string } old_url The old (invalid) URL.
   * @param { string } new_url The new and valid URL.
   */
  public async fix_feed_url( old_url: string, new_url: string ): Promise<void> {
    await this.client.feeds.update({
      where: { url: old_url },
      data: { url: new_url },
    });
  }

  /**
   * Retrieves feed ID from the URL given.
   *
   * @param { string } url The URL to look up feed ID for.
   *
   * @return { number } Returns feed ID for the feed URL given.
   */
  public async get_feed_id_from_url( url: string ): Promise<bigint> {
    return ( await this.client.feeds.findUnique( {
      select: { id: true },
      where:  { url: url },
    } ) ).id;
  }


  /**
   * Updates fetch times only upon unsuccessful RSS fetch.
   *
   * @param { string } feed_url URL for the feed to update statistical data for.
   * @param { string } err_msg  The error message to record for the failed RSS fetch.
   */
  public async inc_fetch_times_only( feed_url: string, err_msg: string ): Promise<void> {
    await this.client.$queryRaw`SELECT update_feed_after_fetch_failed( ${feed_url}, ${err_msg} )`;
  }

  /**
   * Updates feed statistics and fetch times
   * upon successfully finished RSS fetch.
   *
   * @param { string } feed_url                  URL for the feed to update statistical data for.
   * @param { number } date_hour                 Current hour.
   * @param { number } date_day_number           Number of day in week, staring at 0 for Monday.
   * @param { number } date_days_into_year       Number of days into this year.
   * @param { number } date_week_into_year       Number of weeks into this year.
   * @param { number } date_month                Current month number.
   * @param { number } date_full_year            Current full year representation.
   * @param { number } links_count               Count of all links written during the RSS fetch.
   * @param { number } first_link_unix_timestamp Timestamp of the first written RSS link's published date.
   */
  public async inc_stats_and_fetch_times(
    feed_url: string,
    date_hour: number,
    date_day_number: number,
    date_days_into_year: number,
    date_week_into_year: number,
    date_month: number,
    date_full_year: number,
    links_count: number,
    first_link_unix_timestamp: number
  ): Promise<void> {
    await this.client.$queryRaw`SELECT update_feed_after_fetch_success( ${feed_url}, ${date_hour}, ${date_day_number}, ${date_days_into_year}, ${date_week_into_year}, ${date_month}, ${date_full_year}, ${links_count}, ${first_link_unix_timestamp} )`;
  }

  /**
   * Inserts new link into the database for the given feed ID.
   *
   * @param { number } feed_id             ID of the feed to which this links belongs.
   * @param { string } title               Title received for this RSS link. Can be empty.
   * @param { string } description         Description for this RSS link, received from RSS. Can be empty.
   * @param { string } link                Full URL to the article itself.
   * @param { string } image_url           Full URL to the image representing this link. Can be empty.
   * @param { number } date_posted_unix_ts Unix timestamp of the date when this link was posted.
   */
  public async insert_link( feed_id: number, title: string, description: string, link: string, image_url: string, date_posted_unix_ts: number ): Promise<void> {
    await this.client.links.create({
      data: {
        feed_id:     feed_id,
        title:       title,
        description: description,
        link:        link,
        img:         image_url,
        date_posted: date_posted_unix_ts,
      }
    });
  }

  /**
   * Logs error received from the message queue and reported
   * by one of the other services into database.
   *
   * @param { string } service_name     Name of the service that reported the error.
   * @param { number } err_code         Error code reported. These are stored in the Key Store with their unique names.
   * @param { number } log_time_unix_ts Unix timestamp of the error.
   * @param { string } message          Error message received from the reporting service.
   * @param { string } extra_data       Any extra data to be stored with this error message.
   *                                    Provided by the reporting service.
   */
  public async log_error( service_name: string, err_code: number, log_time_unix_ts: number, message: string, extra_data: string ): Promise<void> {
    await this.client.err_log.create({
      data: {
        service_id: service_name,
        code:       err_code,
        log_time:   log_time_unix_ts,
        msg:        message,
        extra:      extra_data,
      }
    });
  }

  /**
   * Updates all feeds with 10+ subsequent failures
   * where last fetch was more than 2 days ago.
   */
  public async update_old_failed_feeds(): Promise<void> {
    await this.client.$queryRaw`SELECT update_old_failed_feeds()`;
  }

  /**
   * Disconnects from the database.
   */
  public async disconnect(): Promise<void> {
    await this.client.$disconnect();
  }

}